// The page's side of saving: writes what the worker hands over to IndexedDB with a name and a
// picture, loads a save back through the worker, autosaves, downloads the ledger export and keeps
// the ledger panel's newest lines.
import { download, openSaves, type SaveMeta, type SaveStore } from '../persist/index.ts';
import type { Renderer } from '../render/index.ts';
import type { FromWorker, LedgerLine, Speed, ToWorker } from '../worker/index.ts';
import type { Hud } from './hud.ts';
import { LEDGER_LINES, type Panel } from './panel.ts';

/** Real time between autosaves while the game runs (ms); hiding the tab also autosaves. A game
 * day at 3x is under 15 s, so a per-day autosave would write the whole world four times a minute. */
export const AUTOSAVE_MS = 60_000;

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
  /** A load is on its way to the worker. */
  loading = false;
  private readonly deps: SavesDeps;
  private readonly store: Promise<SaveStore>;
  /** Why saves are unavailable, or why the last save failed; shown in the save panel. */
  private problem = '';
  private lastAutoTick = -1;
  /** The speed to go back to if a load is refused. */
  private resume: Speed = 0;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(deps: SavesDeps) {
    this.deps = deps;
    this.store = openSaves();
    // The game carries on without saves; the panel says why they are missing.
    this.store.catch((error: unknown) => (this.problem = message(error)));
    this.timer = setInterval(() => {
      if (deps.speed() !== 0 && !document.hidden) this.autosave();
    }, AUTOSAVE_MS);
  }

  addLines(batch: readonly LedgerLine[]): void {
    // After a load the whole ledger arrives in one batch: keep only what the panel can show.
    const newest = batch.slice(-LEDGER_LINES);
    this.ledger.push(...newest);
    if (this.ledger.length > LEDGER_LINES) this.ledger.splice(0, this.ledger.length - LEDGER_LINES);
    this.deps.panel.addLines(newest);
  }

  /** Asks for an autosave unless nothing has run since the last one. */
  autosave(): void {
    if (!this.deps.running() || this.loading || this.tick === this.lastAutoTick) return;
    this.lastAutoTick = this.tick;
    this.deps.send({ type: 'save', auto: true });
  }

  /** The worker's answers about saves and exports. */
  handle(m: FromWorker): void {
    if (m.type === 'saved') void this.write(m);
    else if (m.type === 'exported') download(m.name, m.text);
    else if (m.type === 'loadRefused') {
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
  }

  private async write(m: Extract<FromWorker, { type: 'saved' }>): Promise<void> {
    const { clock, save } = m;
    try {
      await (
        await this.store
      ).put(
        {
          name: `${save.seed} · Day ${clock.day} of ${clock.monthName}, Year ${clock.year}`,
          seed: save.seed,
          tick: save.tick,
          savedAt: Date.now(),
          auto: m.auto,
          // A hidden tab may be closing: write at once, without waiting on a picture.
          thumbnail: document.hidden ? '' : await this.deps.renderer.thumbnail(),
        },
        save,
      );
      this.problem = '';
    } catch (error) {
      this.problem = message(error);
      if (m.auto) this.lastAutoTick = -1;
    }
    if (this.deps.panel.kind === 'saves') await this.showList();
  }
}
