// The page's side of saving: writes what the worker hands over to IndexedDB with a name and a
// picture, loads a save back through the worker, autosaves, downloads the ledger export and keeps
// the ledger panel's newest lines.
import { download, gzip, openSaves, type SaveMeta, type SaveStore } from '../persist/index.ts';
import type { Renderer } from '../render/index.ts';
import type { FromWorker, LedgerLine, SaveFile, Speed, ToWorker } from '../worker/index.ts';
import type { Hud } from './hud.ts';
import { LEDGER_LINES, type Panel } from './panel.ts';

/** Real time between autosaves while the game runs (ms); hiding the tab also autosaves. A game
 * day at 3x is under 15 s, so a per-day autosave would write the whole world four times a minute. */
export const AUTOSAVE_MS = 60_000;
/** Real time between the standby copies the page holds while the game runs (ms). Closing or
 * reloading the tab writes the newest copy at once, so at most this much play is lost: the page
 * has no time left then to ask the worker for a fresh one. */
export const STANDBY_MS = 5_000;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface SavesDeps {
  seed: string;
  renderer: Renderer;
  hud: Hud;
  panel: Panel;
  send(message: ToWorker): void;
  speed(): Speed;
  setSpeed(speed: Speed): void;
  /** Whether a world is running (ready and not stopped). */
  running(): boolean;
}

export class Saves {
  /** The newest ledger lines, oldest first, for the ledger panel. */
  ledger: LedgerLine[] = [];
  /** The tick of the last snapshot. */
  tick = 0;
  /** The tick the world began or was loaded at, from its first snapshot. */
  private startTick: number | undefined;
  /** A load is on its way to the worker. */
  loading = false;
  private readonly deps: SavesDeps;
  private readonly store: Promise<SaveStore>;
  /** The store once open, for writing while the page unloads, when there is no time to wait. */
  private opened: SaveStore | undefined;
  /** The newest standby copy of the running world, not yet written. */
  private standby: Extract<FromWorker, { type: 'saved' }> | undefined;
  private lastStandbyTick = -1;
  /** Why saves are unavailable, or why the last save failed; shown in the save panel. */
  private problem = '';
  private lastAutoTick = -1;
  /** The speed to go back to if a load is refused. */
  private resume: Speed = 0;
  /** Sealed ledger days being archived, in order; a save waits for them, so it never names a day
   * the archive lacks. */
  private archive: Promise<void> = Promise.resolve();
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly standbyTimer: ReturnType<typeof setInterval>;

  constructor(deps: SavesDeps) {
    this.deps = deps;
    this.store = openSaves();
    // The game carries on without saves; the panel says why they are missing.
    this.store.then(
      (store) => (this.opened = store),
      (error: unknown) => (this.problem = message(error)),
    );
    this.timer = setInterval(() => {
      if (deps.speed() !== 0 && !document.hidden) this.autosave();
    }, AUTOSAVE_MS);
    this.standbyTimer = setInterval(() => {
      if (!deps.running() || this.loading || this.tick === this.lastStandbyTick) return;
      if (this.startTick === undefined || this.tick <= this.startTick) return;
      this.lastStandbyTick = this.tick;
      deps.send({ type: 'save', auto: true, standby: true });
    }, STANDBY_MS);
  }

  /**
   * The page is going away (closed, reloaded or hidden): writes the newest standby copy into the
   * autosave slot now, unless a save as new is already written. The write starts before this
   * returns, so it lands even though the page has no time to wait for it.
   */
  flush(): void {
    const copy = this.standby;
    if (!copy || !this.opened || copy.save.tick <= this.lastAutoTick) return;
    this.standby = undefined;
    this.lastAutoTick = copy.save.tick;
    void this.opened.put(this.metaOf(copy, ''), copy.save).catch(() => (this.lastAutoTick = -1));
  }

  /**
   * The newest save to continue from, or undefined: of the world `seed` when given (a reload of
   * that valley), else of any world (the bare link).
   */
  async latest(seed?: string): Promise<SaveFile | undefined> {
    try {
      const store = await this.store;
      const meta = (await store.list()).find((m) => seed === undefined || m.seed === seed);
      return meta && (await store.get(meta.id));
    } catch {
      return undefined;
    }
  }

  addLines(batch: readonly LedgerLine[]): void {
    // After a load the whole ledger arrives in one batch: keep only what the panel can show.
    const newest = batch.slice(-LEDGER_LINES);
    this.ledger.push(...newest);
    if (this.ledger.length > LEDGER_LINES) this.ledger.splice(0, this.ledger.length - LEDGER_LINES);
    this.deps.panel.addLines(newest);
  }

  /** Records a snapshot's tick; the first after a start or a load is where the world began. */
  seen(tick: number): void {
    this.tick = tick;
    this.startTick ??= tick;
  }

  /**
   * Asks for an autosave unless nothing has run since the last one, or since the world began or
   * was loaded: a fresh or just-loaded world must not replace the one autosave slot.
   */
  autosave(): void {
    if (!this.deps.running() || this.loading || this.tick === this.lastAutoTick) return;
    if (this.startTick === undefined || this.tick <= this.startTick) return;
    this.lastAutoTick = this.tick;
    this.deps.send({ type: 'save', auto: true });
  }

  /** The worker's answers about saves and exports. */
  handle(m: FromWorker): void {
    if (m.type === 'saved' && m.standby) this.standby = m;
    else if (m.type === 'saved') void this.write(m);
    else if (m.type === 'exported') void this.export(m);
    else if (m.type === 'segments') {
      const { items } = m;
      this.archive = this.archive
        .then(async () => (await this.store).putSegments(items))
        .catch((error: unknown) => void (this.problem = message(error)));
    } else if (m.type === 'loadRefused') {
      this.loading = false;
      this.deps.hud.showScreen(
        "This save can't be loaded",
        `${m.reason} Saves don't carry over between versions before launch.`,
        ['Back to the game', 'dismiss'],
      );
      // The game stays paused behind the explanation until the player closes it.
    }
  }

  async showList(): Promise<void> {
    const { panel, seed } = this.deps;
    try {
      panel.showSaves(seed, await (await this.store).list(), this.problem);
    } catch (error) {
      panel.showSaves(seed, [], message(error));
    }
  }

  async load(meta: SaveMeta): Promise<void> {
    // A stopped game has no worker to load into; the error screen offers a reload instead.
    if (!this.deps.running() || this.loading) return;
    try {
      const save = await (await this.store).get(meta.id);
      if (!save) throw new Error(`The save "${meta.name}" is missing.`);
      this.resume = this.deps.speed();
      this.deps.setSpeed(0);
      this.loading = true;
      this.deps.hud.showScreen('Loading the save', meta.name);
      this.deps.send({ type: 'load', save });
    } catch (error) {
      this.problem = message(error);
      await this.showList();
    }
  }

  /** The refusal screen was closed: back to the speed from before the load. A hidden tab stays
   * paused; showing it resumes the speed it was hidden at. */
  dismissed(): void {
    if (!document.hidden && this.deps.running()) this.deps.setSpeed(this.resume);
  }

  /** The worker adopted a loaded world: its ledger is resent from the start. */
  loaded(): void {
    this.loading = false;
    this.ledger = [];
    this.lastAutoTick = -1;
    this.lastStandbyTick = -1;
    this.standby = undefined;
    this.startTick = undefined;
  }

  async remove(meta: SaveMeta): Promise<void> {
    try {
      await (await this.store).remove(meta.id);
    } catch (error) {
      this.problem = message(error);
    }
    await this.showList();
  }

  stop(): void {
    clearInterval(this.timer);
    clearInterval(this.standbyTimer);
  }

  private metaOf(m: Extract<FromWorker, { type: 'saved' }>, thumbnail: string) {
    const { clock, save } = m;
    return {
      name: `${save.seed} · Day ${clock.day} of ${clock.monthName}, Year ${clock.year}`,
      seed: save.seed,
      tick: save.tick,
      savedAt: Date.now(),
      auto: m.auto,
      thumbnail,
    };
  }

  /** Downloads the ledger: the archived days as stored (gzipped) and the recent ones, gzipped too,
   * joined into one gzip file without unpacking (a ten-year ledger would not fit one string). */
  private async export(m: Extract<FromWorker, { type: 'exported' }>): Promise<void> {
    try {
      await this.archive;
      const store = await this.store;
      const days = await Promise.all(m.segments.map((key) => store.getSegment(key)));
      const missing = days.filter((d) => !d).length;
      download(`${m.name}.gz`, [...days.filter((d) => d !== undefined), await gzip(m.text)]);
      this.problem = missing ? `${missing} older days of the ledger are not in this browser.` : '';
    } catch (error) {
      this.problem = message(error);
    }
  }

  /**
   * The engine stopped: writes the newest standby copy, with the levers given since it was taken,
   * into the rescue slot (P2.0), so the fault can be replayed. Returns the copy's date for the
   * error screen, or undefined when there is no copy to keep.
   */
  async rescue(m: Extract<FromWorker, { type: 'error' }>): Promise<string | undefined> {
    const copy = this.standby;
    if (!copy) return undefined;
    try {
      // A copy: the standby itself may still become the autosave as the page closes.
      const save = structuredClone(copy.save);
      const { state } = save;
      const last = state.commandLog.at(-1)?.seq ?? 0;
      for (const command of m.commands ?? [])
        if (command.seq > last) {
          state.commandLog.push(command);
          state.pending.push(command);
        }
      state.pending.sort((a, b) => a.tick - b.tick || a.seq - b.seq);
      await this.archive;
      const meta = { ...this.metaOf(copy, ''), auto: false, rescue: m.message };
      await (await this.store).put({ ...meta, name: `Rescue · ${meta.name}` }, save);
      const { clock } = copy;
      return `Day ${clock.day} of ${clock.monthName}, Year ${clock.year}`;
    } catch {
      return undefined;
    }
  }

  private async write(m: Extract<FromWorker, { type: 'saved' }>): Promise<void> {
    try {
      await this.archive;
      // A hidden tab may be closing: write at once, without waiting on a picture.
      const thumbnail = document.hidden ? '' : await this.deps.renderer.thumbnail();
      await (await this.store).put(this.metaOf(m, thumbnail), m.save);
      // A standby copy older than this save must not replace it as the newest when the tab closes.
      this.lastAutoTick = Math.max(this.lastAutoTick, m.save.tick);
      this.problem = '';
    } catch (error) {
      this.problem = message(error);
      if (m.auto) this.lastAutoTick = -1;
    }
    if (this.deps.panel.kind === 'saves') await this.showList();
  }
}
