// The simulation worker: owns the one engine instance, runs it at the chosen speed and answers
// the page. The only place the engine is instantiated (MODULE.md).
import { content, contentHash } from '../content/index.ts';
import {
  CHUNK,
  chunksAcross,
  chunksDown,
  chunkTiles,
  clockAt,
  createSim,
  createWorld,
  findEvent,
  renderEvent,
  step,
  submitCommand,
  toNdjson,
  whyOf,
  type SimEvent,
  type WorldState,
} from '../engine/index.ts';
import { createPace, setSpeed, ticksDue } from './pace.ts';
import type {
  ChunkView,
  ClockView,
  FromWorker,
  LedgerLine,
  TileView,
  ToWorker,
} from './protocol.ts';
import { checkSave, saveOf } from './save.ts';

/** How often the worker wakes (ms). Timing comes from the clock, not from this interval. */
const WAKE_MS = 10;

const sim = createSim(content);
let world: WorldState | undefined;
let pace = createPace(performance.now());
/** Chunk versions the page has already been sent; empty until the first snapshot. */
let sent: number[] = [];
/** Index of the first ledger line not yet posted. */
let posted = 0;
let timer: ReturnType<typeof setInterval> | undefined;

const post = (message: FromWorker, transfer: Transferable[] = []): void =>
  postMessage(message, { transfer });

function run(ticks: number): void {
  if (world && ticks > 0) step(world, sim, ticks);
}

function clockView(tick: number): ClockView {
  const c = clockAt(tick, content.calendar);
  return {
    year: c.year,
    monthName: content.calendar.monthNames[c.month]!,
    day: c.day,
    hour: c.hour,
    minute: c.minute,
    season: content.calendar.seasons[c.season]!,
  };
}

const lineOf = (e: SimEvent): LedgerLine => ({
  id: e.id,
  tick: e.tick,
  type: e.type,
  text: renderEvent(e, sim.templates),
  causes: [...e.causes],
  why: e.causes.some((c) => c !== world?.begunEvent),
  clock: clockView(e.tick),
});

function snapshot(w: WorldState): void {
  if (posted < w.log.length) {
    post({ type: 'events', batch: w.log.slice(posted).map(lineOf) });
    posted = w.log.length;
  }
  const chunks: ChunkView[] = [];
  const across = chunksAcross(w.map);
  for (let cy = 0; cy < chunksDown(w.map); cy += 1)
    for (let cx = 0; cx < across; cx += 1) {
      const i = cy * across + cx;
      if (sent[i] === w.map.chunkVersions[i]) continue;
      sent[i] = w.map.chunkVersions[i]!;
      chunks.push(chunkTiles(w.map, cx, cy));
    }
  post(
    { type: 'snapshot', tick: w.tick, speed: pace.speed, clock: clockView(w.tick), chunks },
    chunks.map((chunk) => chunk.tiles.buffer),
  );
}

function tileView(w: WorldState, x: number, y: number): TileView | undefined {
  const { map } = w;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return undefined;
  if (x >= map.width || y >= map.height) return undefined;
  const chunkX = Math.floor(x / CHUNK);
  const chunkY = Math.floor(y / CHUNK);
  const changedBy = findEvent(w.log, map.tileCauses[y * map.width + x]!);
  return {
    x,
    y,
    ground: content.terrain.kinds[map.tiles[y * map.width + x]!]!.name,
    chunkX,
    chunkY,
    version: map.chunkVersions[chunkY * chunksAcross(map) + chunkX]!,
    ...(changedBy && { changedBy: lineOf(changedBy) }),
  };
}

/** Makes `w` the running world, paused, with everything sent afresh. `init` and `load` both end
 * here, so a loaded world and a new one start the same way. */
function adopt(w: WorldState, from: 'seed' | 'save'): void {
  world = w;
  sent = [];
  posted = 0;
  pace = createPace(performance.now());
  timer ??= setInterval(() => guarded(() => run(ticksDue(pace, performance.now()))), WAKE_MS);
  post({
    type: 'ready',
    from,
    seed: w.seed,
    contentHash,
    width: w.map.width,
    height: w.map.height,
  });
}

function handle(message: ToWorker): void {
  switch (message.type) {
    case 'init':
      if (message.contentHash !== contentHash)
        throw new Error(
          `The page's content (${message.contentHash}) differs from the worker's (${contentHash}).`,
        );
      adopt(createWorld(sim, message.seed), 'seed');
      return;
    case 'load': {
      // Checked before anything is replaced: a refused save leaves the running world as it was.
      let loaded: WorldState;
      try {
        loaded = checkSave(message.save, contentHash, content);
      } catch (error) {
        post({
          type: 'loadRefused',
          reason: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      adopt(loaded, 'save');
      return;
    }
    case 'setSpeed':
      run(setSpeed(pace, message.speed, performance.now()));
      return;
    case 'requestSnapshot':
      if (world) snapshot(world);
      return;
    case 'command':
      if (!world) throw new Error('A command arrived before the world began.');
      submitCommand(world, message);
      return;
    // The rest only read the world, between ticks; with no world (stopped) they go unanswered.
    case 'save':
      if (world)
        post({
          type: 'saved',
          auto: message.auto,
          save: saveOf(world, contentHash),
          clock: clockView(world.tick),
        });
      return;
    case 'export':
      if (world)
        post({
          type: 'exported',
          kind: message.kind,
          name: `${world.seed.replace(/[^\w-]+/g, '-')}-tick-${world.tick}.ndjson`,
          text: toNdjson(world.log),
        });
      return;
    case 'inspect':
      if (world) post({ type: 'inspected', tile: tileView(world, message.x, message.y) });
      return;
    case 'why':
      if (world)
        post({
          type: 'causes',
          id: message.id,
          lines: whyOf(world.log, message.id).map(({ event, depth }) => ({
            ...lineOf(event),
            depth,
          })),
        });
      return;
  }
}

// Any throw stops the simulation and reports it: nothing keeps running half-broken.
function guarded(work: () => void): void {
  try {
    work();
  } catch (error) {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    world = undefined;
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}

onmessage = (e: MessageEvent<ToWorker>) => guarded(() => handle(e.data));
