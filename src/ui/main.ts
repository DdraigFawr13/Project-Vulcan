// The page entry: starts the simulation worker and the renderer, asks the worker for a snapshot
// once per screen frame (at most one request in flight), and routes the player's keys.
import { contentHash } from '../content/index.ts';
import { startRenderer } from '../render/index.ts';
import { spawnSimWorker, type FromWorker, type Speed, type ToWorker } from '../worker/index.ts';
import { Hud } from './hud.ts';

const parent = document.getElementById('game');
const hudRoot = document.getElementById('hud');
if (!parent || !hudRoot) throw new Error('index.html is missing #game or #hud');

const seed = new URLSearchParams(location.search).get('seed') ?? 'ledger-1';
const worker = spawnSimWorker();
const send = (message: ToWorker): void => worker.postMessage(message);
let speed: Speed = 0;
/** The speed Space resumes to. */
let lastRunning: Exclude<Speed, 0> = 1;
let ready = false;
let waiting = false;
let stopped = false;
let frame = 0;

const setSpeed = (next: Speed): void => {
  if (stopped) return;
  speed = next;
  if (next !== 0) lastRunning = next;
  send({ type: 'setSpeed', speed: next });
};

const renderer = startRenderer(parent, {
  onHover: (tile) => hud.showTile(tile),
  onZoom: () => {},
});
hudRoot.replaceChildren();
const hud = new Hud(hudRoot, {
  setSpeed,
  zoom: (direction) => renderer.zoomStep(direction),
  reload: () => location.reload(),
});

worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const message = e.data;
  try {
    if (message.type === 'ready') {
      renderer.setMapSize(message.width, message.height);
      ready = true;
    } else if (message.type === 'snapshot') {
      waiting = false;
      renderer.applyChunks(message.chunks);
      hud.fps = Math.round(renderer.fps());
      hud.showClock(message.clock, message.tick, message.speed);
      hud.hideScreen();
    } else if (message.type === 'error') {
      fail(message.message);
    }
  } catch (error) {
    // The worker has marked these chunks as sent, so a drawing failure must stop the game too.
    fail(error instanceof Error ? error.message : String(error));
  }
  // `events` batches are kept for the ledger panel (P0.5); P0.4 only receives them.
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
  cancelAnimationFrame(frame);
  worker.terminate();
}

function onKey(e: KeyboardEvent): void {
  // Leave the browser's own shortcuts (zoom, tab switching) alone.
  if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === ' ')) return;
  if (e.key === ' ') setSpeed(speed === 0 ? lastRunning : 0);
  else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(Number(e.key) as Speed);
  else if (e.key === '+' || e.key === '=') renderer.zoomStep(1);
  else if (e.key === '-' || e.key === '_') renderer.zoomStep(-1);
  else return;
  e.preventDefault();
}

// A hidden tab pauses, so no game time passes unseen, and resumes at its speed when shown again.
let hiddenAt: Speed | undefined;
function onVisibility(): void {
  if (document.hidden && hiddenAt === undefined) {
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

send({ type: 'init', seed, contentHash });
setSpeed(0);
frame = requestAnimationFrame(tick);
