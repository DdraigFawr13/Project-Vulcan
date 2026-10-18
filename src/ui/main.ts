// The page entry: starts the worker and the renderer, asks for a snapshot once per screen frame
// (one request in flight), routes keys, and wires the title, arrival screen and panels.
import { contentHash } from '../content/index.ts';
import { startRenderer } from '../render/index.ts';
import {
  spawnSimWorker,
  type FromWorker,
  type LedgerLine,
  type PersonView,
  type Speed,
  type TileView,
  type ToWorker,
} from '../worker/index.ts';
import { showArrival } from './arrival.ts';
import { Hud } from './hud.ts';
import { Panel } from './panel.ts';
import { Picker } from './picker.ts';
import { Saves } from './saves.ts';
import { OLD_SAVE, Title } from './title.ts';

const parent = document.getElementById('game');
const hudRoot = document.getElementById('hud');
if (!parent || !hudRoot) throw new Error('index.html is missing #game or #hud');

const params = new URLSearchParams(location.search);
const seed = params.get('seed') ?? 'ledger-1';
// A seed alone opens the site picker; with `site` it begins that valley (P1.5).
const site = params.get('site');
/** `?debug` shows developer readouts: fps, tick, and the inspector's chunk row. */
const debug = params.has('debug');
const worker = spawnSimWorker();
const send = (message: ToWorker): void => worker.postMessage(message);
let speed: Speed = 0;
/** The speed Space resumes to. */
let lastRunning: Exclude<Speed, 0> = 1;
let ready = false;
/** The level on screen (0 the surface), how many lie below, and which of them are reached. */
let level = 0;
let depth = 0;
let reached: boolean[] = [];
let worldTick = 0;
let waiting = false;
let stopped = false;
let frame = 0;
/** The inspector's last dig order: its tile and the tick it is stamped for; then the line that
 * answered it (a refusal is kept to show) and whether the tile has been asked for again since. */
let order:
  | {
      x: number;
      y: number;
      z: number;
      tick: number;
      answered?: boolean;
      refused?: LedgerLine;
      asked?: boolean;
    }
  | undefined;
/** The ledger lines that answer a dig order. At 3x an order can land a tick or two late. */
const ANSWERS = ['map.stairsCut', 'map.shaftSunk', 'map.digRefused'];
/** The tile the inspector last showed. */
let shown: TileView | undefined;
const PAUSED_NOTE = 'Paused: this is dug on the next game minute once time runs (1×, 2× or 3×).';
/** The starting or loading screen is up until the next snapshot; other screens wait for a click. */
let covering = true;
/** The running world's valley and people, and whether the band has just arrived (P2.1). */
let place = '';
let people: readonly PersonView[] = [];
let arriving = false;
/** The title screen while it is up (P2.1), waiting for a loaded save's first snapshot. */
let title: Title | undefined;
let titleWaits = false;
/** The title or the arrival screen covers the game: its bar and keys are hidden until closed. */
const cover = (on: boolean): void => void hudRoot.classList.toggle('covered', on);
const setSpeed = (next: Speed): void => {
  // Until a world is ready, or while a save loads, the worker resets the speed itself.
  if (stopped || !ready || saves.loading) return;
  speed = next;
  if (next !== 0) lastRunning = next;
  send({ type: 'setSpeed', speed: next });
};

const renderer = startRenderer(parent, {
  onHover: (tile) => hud.showTile(tile),
  onSelect: (tile) => {
    const person = renderer.personAt(tile.x, tile.y);
    if (!person) return send({ type: 'inspect', ...tile, z: level });
    panel.showPerson(person);
    renderer.mark(tile);
    hud.showPanel(undefined);
  },
});
hudRoot.replaceChildren();
const hud = new Hud(
  hudRoot,
  {
    setSpeed,
    zoom: (direction) => renderer.zoomStep(direction),
    level: (direction) => setLevel(level + direction),
    reload: () => location.reload(),
    togglePanel: (kind) => (panel.kind === kind ? closePanel() : openPanel(kind)),
    dismissed: () => saves.dismissed(),
  },
  debug,
);
// The bar wraps to two rows on a phone: keep the camera's fit and bounds clear of it.
new ResizeObserver(() => renderer.setTopInset(hud.bar.offsetHeight)).observe(hud.bar);
const panel = new Panel(
  hudRoot,
  {
    why: (id) => send({ type: 'why', id }),
    save: () => send({ type: 'save', auto: false }),
    exportLedger: () => send({ type: 'export', kind: 'ndjson' }),
    load: (meta) => void saves.load(meta),
    remove: (meta) => void saves.remove(meta),
    dig: (tile, kind, to) => {
      const { x, y, z } = tile;
      order = { x, y, z, tick: worldTick + 1 };
      send({
        type: 'command',
        tick: order.tick,
        kind,
        data: { x, y, z, ...(to !== undefined && { to }) },
      });
      // Asked again at once so a paused game says the order waits; the snapshot past the order's
      // answer asks once more to show the stairs, or why they were not cut.
      send({ type: 'inspect', x, y, z });
    },
    go: (tile, z) => {
      setLevel(z);
      if (level === z) send({ type: 'inspect', x: tile.x, y: tile.y, z });
    },
    newGame: (next) => roll(next),
    close: () => closePanel(),
  },
  debug,
);
const picker = new Picker(hudRoot, {
  settle: (chosen) => {
    // A reload comes straight back to this valley; New game or a new seed opens the picker again.
    history.replaceState(null, '', `?seed=${encodeURIComponent(seed)}&site=${chosen}`);
    picker.hide();
    hud.showScreen('Waking the valley', 'Settling the band in the valley.');
    send({ type: 'settle', site: chosen });
  },
  roll: (next) => roll(next),
});
function roll(next: string): void {
  location.search = `?seed=${encodeURIComponent(next)}`;
}
const saves = new Saves({
  seed,
  renderer,
  hud,
  panel,
  send,
  speed: () => speed,
  setSpeed,
  running: () => ready && !stopped,
});

function setLevel(z: number): void {
  if (!ready || z < 0 || z > depth || z === level) return;
  level = z;
  closePanel();
  renderer.setLevel(z);
  hud.showLevel(z, depth, z === 0 || reached[z - 1] === true);
}

/** What became of the last dig order on `tile`, once: it waits while paused, or the line refusing
 * it once answered. */
function noticeFor(tile: TileView): string | LedgerLine | undefined {
  if (!order || order.x !== tile.x || order.y !== tile.y || order.z !== tile.z) return undefined;
  if (!order.answered) return speed === 0 ? PAUSED_NOTE : undefined;
  const { refused } = order;
  order = undefined;
  return refused;
}

function openPanel(kind: 'ledger' | 'saves' | 'region'): void {
  renderer.mark(undefined);
  if (kind === 'ledger') panel.showLedger(saves.ledger);
  else if (kind === 'region') send({ type: 'region' });
  else void saves.showList();
  hud.showPanel(kind);
}

function closePanel(): void {
  panel.hide();
  renderer.mark(undefined);
  hud.showPanel(undefined);
}

worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const message = e.data;
  try {
    if (message.type === 'ready') {
      renderer.setMapSize(message.width, message.height);
      ready = true;
      depth = message.depth;
      reached = [];
      level = 0;
      order = undefined;
      hud.showLevel(0, depth, true);
      place = message.place;
      people = message.people;
      arriving = message.from === 'seed' && message.fresh && people.length > 0;
      renderer.setPeople(people);
      // A loaded world starts paused, like a new one.
      speed = 0;
      if (message.from === 'save') {
        closePanel();
        saves.loaded();
        covering = true;
        // A loaded world starts paused even if the tab was hidden while it loaded.
        if (hiddenAt !== undefined) hiddenAt = 0;
      }
    } else if (message.type === 'snapshot') {
      waiting = false;
      worldTick = message.tick;
      if (order?.answered && !order.asked) {
        order.asked = true;
        const { x, y, z } = order;
        if (panel.kind === 'tile' && shown?.x === x && shown.y === y && shown.z === z)
          send({ type: 'inspect', x, y, z });
      }
      reached = message.reached;
      renderer.applyChunks(message.chunks);
      renderer.movePeople(message.walkers);
      renderer.setAura(message.aura);
      hud.showLevel(level, depth, level === 0 || reached[level - 1] === true);
      hud.fps = Math.round(renderer.fps());
      if (debug) hud.showTiming(message.timing);
      hud.showClock(message.clock, message.tick, message.speed, message.at, message.weather);
      saves.seen(message.tick);
      const date = `Day ${message.clock.day} of ${message.clock.monthName}, Year ${message.clock.year}`;
      if (title && titleWaits) {
        titleWaits = false;
        title.ready(place, date);
      }
      if (arriving) {
        arriving = false;
        cover(true);
        showArrival(hudRoot, place, date, people, () => cover(false));
      }
      if (covering && !saves.loading) {
        hud.hideScreen();
        covering = false;
      }
    } else if (message.type === 'events') {
      saves.addLines(message.batch);
      // The answer's lines come just before the snapshot that asks for the tile again.
      for (const line of message.batch)
        if (order && !order.answered && ANSWERS.includes(line.type) && line.tick >= order.tick) {
          order.answered = true;
          if (line.type === 'map.digRefused') order.refused = line;
        }
    } else if (message.type === 'inspected') {
      // A reply about a level the player has since left is dropped.
      if (message.tile && message.tile.z === level) {
        shown = message.tile;
        panel.showTile(message.tile, depth, noticeFor(message.tile));
        renderer.mark(message.tile);
        hud.showPanel(undefined);
      }
    } else if (message.type === 'picker') {
      hud.hideScreen();
      picker.show(message);
    } else if (message.type === 'region') {
      if (message.region) panel.showRegion(message.region, message.site);
      else
        panel.showNote(
          'Region',
          'This world began from a plain seed, before regions, so it has no region map.',
        );
    } else if (message.type === 'causes') {
      panel.showCauses(message.id, message.lines);
    } else if (message.type === 'loadRefused' && !ready) {
      // The save to continue from no longer loads (another version): the title offers New game
      // alone and says why; a reloaded valley begins afresh instead.
      saves.loading = false;
      titleWaits = false;
      if (title) title.empty(OLD_SAVE);
      else begin();
    } else if (message.type === 'error') {
      fail(message.message);
      // The last good copy goes to the rescue slot; the screen then says which day it keeps.
      void saves.rescue(message).then((kept) => kept && hud.showError(message.message, kept));
    } else {
      saves.handle(message);
    }
  } catch (error) {
    // The worker has marked these chunks as sent, so a drawing failure must stop the game too.
    fail(error instanceof Error ? error.message : String(error));
  }
};
worker.onerror = (e) => fail(e.message || 'The simulation worker failed to start.');

function fail(message: string): void {
  stop();
  hud.showError(message);
}

function tick(): void {
  if (ready && !waiting && !stopped) {
    waiting = true;
    send({ type: 'requestSnapshot' });
  }
  frame = requestAnimationFrame(tick);
}

function stop(): void {
  stopped = true;
  saves.stop();
  cancelAnimationFrame(frame);
  worker.terminate();
}

function onKey(e: KeyboardEvent): void {
  if (hudRoot!.classList.contains('covered')) return; // the title or arrival screen is up
  // Leave the browser's own shortcuts (zoom, tab switching) alone.
  if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === ' ')) return;
  // Typing a seed in the save panel is not a game key.
  if ((e.target as HTMLElement).closest?.('input')) return;
  if (e.key === 'Escape') closePanel();
  else if (e.key === ' ') setSpeed(speed === 0 ? lastRunning : 0);
  else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(Number(e.key) as Speed);
  else if (e.key === '+' || e.key === '=') renderer.zoomStep(1);
  else if (e.key === '-' || e.key === '_') renderer.zoomStep(-1);
  else if (e.key === '>' || e.key === 'PageDown') setLevel(level + 1);
  else if (e.key === '<' || e.key === 'PageUp') setLevel(level - 1);
  else return;
  e.preventDefault();
}

// A hidden tab pauses, so no game time passes unseen, and resumes at its speed when shown again.
let hiddenAt: Speed | undefined;
function onVisibility(): void {
  if (document.hidden && hiddenAt === undefined) {
    // Hiding is the last sure moment before a tab is closed or discarded: write the standby copy
    // now, and ask for a fresh autosave in case the tab is only switched away.
    saves.flush();
    saves.autosave();
    hiddenAt = speed;
    if (speed !== 0) send({ type: 'setSpeed', speed: 0 });
  } else if (!document.hidden && hiddenAt !== undefined) {
    if (!stopped && hiddenAt !== 0) send({ type: 'setSpeed', speed: hiddenAt });
    hiddenAt = undefined;
  }
}

// A page kept in the back-forward cache keeps its worker; only a real unload stops it.
const onPageHide = (e: PageTransitionEvent): void => {
  saves.flush();
  if (!e.persisted) stop();
};

addEventListener('keydown', onKey);
addEventListener('pagehide', onPageHide);
document.addEventListener('visibilitychange', onVisibility);
import.meta.hot?.dispose(() => {
  stop();
  removeEventListener('keydown', onKey);
  removeEventListener('pagehide', onPageHide);
  document.removeEventListener('visibilitychange', onVisibility);
  renderer.destroy();
});

function begin(): void {
  send({ type: 'init', seed: site ? `${seed}/${site}` : seed, contentHash });
}

// Opening the bare link shows the title (P2.1): the newest save loads behind it, dimmed, and
// Continue lifts the title; New game opens the region map. Reloading a settled valley continues
// its newest save at once; a seed on its own (New game, New seed) opens the picker afresh.
if (!params.has('seed')) {
  cover(true);
  title = new Title(hudRoot, {
    continue: () => {
      title?.hide();
      title = undefined;
      cover(false);
    },
    newGame: () => roll(seed),
  });
}
if (!params.has('seed') || site) {
  void saves.latest(site ? `${seed}/${site}` : undefined).then((save) => {
    if (!save) return title ? title.empty() : begin();
    const at = /^(.+)\/([1-9])$/.exec(save.seed);
    const keep = debug ? '&debug' : '';
    if (at)
      history.replaceState(null, '', `?seed=${encodeURIComponent(at[1]!)}&site=${at[2]}${keep}`);
    saves.loading = true;
    titleWaits = !!title;
    if (title) title.loading();
    else hud.showScreen('Continuing', `${save.seed}, where it was last saved.`);
    send({ type: 'load', save });
  });
} else begin();
frame = requestAnimationFrame(tick);
