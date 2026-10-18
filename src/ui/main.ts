// The page entry: starts the simulation worker and the renderer, asks the worker for a snapshot
// once per screen frame (at most one request in flight), routes the player's keys, and wires
// the panels: inspector, ledger, saves and export.
import { contentHash } from '../content/index.ts';
import { startRenderer } from '../render/index.ts';
import { spawnSimWorker, type FromWorker, type Speed, type ToWorker } from '../worker/index.ts';
import { Hud } from './hud.ts';
import { Panel } from './panel.ts';
import { Picker } from './picker.ts';
import { Saves } from './saves.ts';

const parent = document.getElementById('game');
const hudRoot = document.getElementById('hud');
if (!parent || !hudRoot) throw new Error('index.html is missing #game or #hud');

const params = new URLSearchParams(location.search);
const seed = params.get('seed') ?? 'ledger-1';
// A seed alone opens the site picker; with `site` it begins that valley (P1.5).
const site = params.get('site');
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
/** The starting or loading screen is up until the next snapshot; other screens wait for a click. */
let covering = true;

const setSpeed = (next: Speed): void => {
  // Until a world is ready, or while a save loads, the worker resets the speed itself.
  if (stopped || !ready || saves.loading) return;
  speed = next;
  if (next !== 0) lastRunning = next;
  send({ type: 'setSpeed', speed: next });
};

const renderer = startRenderer(parent, {
  onHover: (tile) => hud.showTile(tile),
  onSelect: (tile) => send({ type: 'inspect', ...tile, z: level }),
});
hudRoot.replaceChildren();
const hud = new Hud(hudRoot, {
  setSpeed,
  zoom: (direction) => renderer.zoomStep(direction),
  level: (direction) => setLevel(level + direction),
  reload: () => location.reload(),
  togglePanel: (kind) => (panel.kind === kind ? closePanel() : openPanel(kind)),
  dismissed: () => saves.dismissed(),
});
const panel = new Panel(hudRoot, {
  why: (id) => send({ type: 'why', id }),
  save: () => send({ type: 'save', auto: false }),
  exportLedger: () => send({ type: 'export', kind: 'ndjson' }),
  load: (meta) => void saves.load(meta),
  remove: (meta) => void saves.remove(meta),
  dig: (tile, kind, to) =>
    send({
      type: 'command',
      tick: worldTick + 1,
      kind,
      data: { x: tile.x, y: tile.y, z: tile.z, ...(to !== undefined && { to }) },
    }),
  newGame: (next) => roll(next),
  close: () => closePanel(),
});
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
      hud.showLevel(0, depth, true);
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
      reached = message.reached;
      renderer.applyChunks(message.chunks);
      renderer.setAura(message.aura);
      hud.showLevel(level, depth, level === 0 || reached[level - 1] === true);
      hud.fps = Math.round(renderer.fps());
      hud.showClock(message.clock, message.tick, message.speed, message.at, message.weather);
      saves.seen(message.tick);
      if (covering && !saves.loading) {
        hud.hideScreen();
        covering = false;
      }
    } else if (message.type === 'events') {
      saves.addLines(message.batch);
    } else if (message.type === 'inspected') {
      // A reply about a level the player has since left is dropped.
      if (message.tile && message.tile.z === level) {
        panel.showTile(message.tile, depth);
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
    } else if (message.type === 'error') {
      fail(message.message);
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
    // Hiding is the last sure moment before a tab is closed or discarded: autosave then.
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

send({ type: 'init', seed: site ? `${seed}/${site}` : seed, contentHash });
frame = requestAnimationFrame(tick);
