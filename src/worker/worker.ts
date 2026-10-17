// The simulation worker: owns the one engine instance, runs it at the chosen speed and answers
// the page. The only place the engine is instantiated (MODULE.md).
import { content, contentHash } from '../content/index.ts';
import {
  chunksAcross,
  chunksDown,
  chunkTiles,
  clockAt,
  createSim,
  createWorld,
  step,
  submitCommand,
  type WorldState,
} from '../engine/index.ts';
import { createPace, setSpeed, ticksDue } from './pace.ts';
import type { ChunkView, FromWorker, ToWorker } from './protocol.ts';

/** How often the worker wakes (ms). Timing comes from the clock, not from this interval. */
const WAKE_MS = 10;

const sim = createSim(content);
let world: WorldState | undefined;
const pace = createPace(performance.now());
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

function snapshot(w: WorldState): void {
  if (posted < w.log.length) {
    post({ type: 'events', batch: w.log.slice(posted) });
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
  const c = clockAt(w.tick, content.calendar);
  post(
    {
      type: 'snapshot',
      tick: w.tick,
      speed: pace.speed,
      clock: {
        year: c.year,
        monthName: content.calendar.monthNames[c.month]!,
        day: c.day,
        hour: c.hour,
        minute: c.minute,
        season: content.calendar.seasons[c.season]!,
      },
      chunks,
    },
    chunks.map((chunk) => chunk.tiles.buffer),
  );
}

function handle(message: ToWorker): void {
  switch (message.type) {
    case 'init':
      if (message.contentHash !== contentHash)
        throw new Error(`The page and the worker have different content (${contentHash}).`);
      world = createWorld(sim, message.seed);
      sent = [];
      posted = 0;
      timer ??= setInterval(() => guarded(() => run(ticksDue(pace, performance.now()))), WAKE_MS);
      post({
        type: 'ready',
        seed: world.seed,
        contentHash,
        width: world.map.width,
        height: world.map.height,
      });
      return;
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
    case 'load':
    case 'export':
      throw new Error(`"${message.type}" arrives with saves in P0.5.`);
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
