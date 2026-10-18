// The simulation worker: owns the one engine instance, runs it at the chosen speed and answers
// the page. The only place the engine is instantiated (MODULE.md).
import { content, contentHash } from '../content/index.ts';
import {
  chunksAcross,
  chunksDown,
  chunkTiles,
  createSim,
  createWorld,
  layerOf,
  makeRegion,
  renderEvent,
  siteOf,
  START_TICK,
  step,
  valleyOf,
  submitCommand,
  SYSTEMS,
  toNdjson,
  whyOf,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { createPace, setSpeed, SKIP_MS, ticksDue } from './pace.ts';
import { createTiming, recordTick, timedSystems } from './timing.ts';
import type { ChunkView, FromWorker, LedgerLine, ToWorker } from './protocol.ts';
import { pickerBuffers, previewOf, regionView } from './region.ts';
import { checkSave, saveOf } from './save.ts';
import { peopleOf } from './people.ts';
import { clockView, tileView, weatherOf } from './views.ts';

/** How often the worker wakes (ms). Timing comes from the clock, not from this interval. */
const WAKE_MS = 10;

const timing = createTiming(SYSTEMS.length);
const sim = createSim(
  content,
  timedSystems(SYSTEMS, timing, () => performance.now()),
);
const systemNames = SYSTEMS.map((s) => s.id);
let world: WorldState | undefined;
let pace = createPace(performance.now());
/** Chunk versions the page has already been sent, per level; empty until the first snapshot. */
let sent: number[][] = [];
/** Ledger lines written since the last snapshot, collected as they are written: sealing trims
 * the log's front, so a long run could otherwise seal lines before they were posted. */
let unposted: SimEvent[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
/** The valleys on offer in the picker, made from their seeds and not yet run. */
let offered: WorldState[] = [];

const post = (message: FromWorker, transfer: Transferable[] = []): void =>
  postMessage(message, { transfer });

/** Runs one tick, timed, and collects its lines: sealing trims the log's front at midnight. */
function tickOnce(w: WorldState): void {
  const start = performance.now();
  for (const line of step(w, sim, 1)) unposted.push(line);
  recordTick(timing, performance.now() - start, systemNames);
}

/** Runs `ticks` ticks, or, skipping ahead (P2.7), as many as fit in `SKIP_MS`; then hands the
 * days sealed meanwhile to the page to archive, so a save never carries them. */
function run(ticks: number): void {
  const w = world;
  if (!w) return;
  if (pace.skip) {
    const until = performance.now() + SKIP_MS;
    while (performance.now() < until) tickOnce(w);
  } else for (let i = 0; i < ticks; i += 1) tickOnce(w);
  if (w.sealed.length) {
    post({ type: 'segments', items: w.sealed.map(({ key, text }) => ({ key, text })) });
    w.sealed = [];
  }
}

function lineOf(e: SimEvent | Stub): LedgerLine {
  const clock = clockView(e.tick);
  if (!('causes' in e))
    return {
      id: e.id,
      tick: e.tick,
      type: e.type,
      text: `An older record, from Day ${clock.day} of ${clock.monthName}, year ${clock.year}.`,
      causes: [],
      why: false,
      clock,
      older: true,
    };
  return {
    id: e.id,
    tick: e.tick,
    type: e.type,
    text: renderEvent(e, sim.templates),
    causes: [...e.causes],
    why: e.causes.some((c) => c !== world?.begunEvent),
    clock,
  };
}

function snapshot(w: WorldState): void {
  if (unposted.length) {
    post({ type: 'events', batch: unposted.map(lineOf) });
    unposted = [];
  }
  const chunks: ChunkView[] = [];
  const across = chunksAcross(w.map);
  for (let z = 0; z <= w.map.levels.length; z += 1) {
    const layer = layerOf(w.map, z);
    if (!layer) continue;
    const seen = (sent[z] ??= []);
    for (let cy = 0; cy < chunksDown(w.map); cy += 1)
      for (let cx = 0; cx < across; cx += 1) {
        const i = cy * across + cx;
        if (seen[i] === layer.chunkVersions[i]) continue;
        seen[i] = layer.chunkVersions[i]!;
        chunks.push(chunkTiles(w.map, cx, cy, z));
      }
  }
  post(
    {
      type: 'snapshot',
      tick: w.tick,
      at: pace.last,
      speed: pace.speed,
      clock: clockView(w.tick),
      chunks,
      reached: w.map.levels.map((level) => level !== null),
      weather: weatherOf(w),
      aura: w.map.auraSpots.map(({ school, x, y, z, strength }) => ({ school, x, y, z, strength })),
      timing: timing.view,
    },
    chunks.flatMap((c) => [c.tiles.buffer, c.features.buffer, c.snow.buffer, c.ice.buffer]),
  );
}

/** Makes `w` the running world, paused, with everything sent afresh. `init` and `load` both end
 * here, so a loaded world and a new one start the same way. */
function adopt(w: WorldState, from: 'seed' | 'save'): void {
  world = w;
  sent = [];
  unposted = [...w.log];
  pace = createPace(performance.now());
  run(0); // hands over any sealed days the world arrived with (never ticks: the pace is fresh)
  timer ??= setInterval(() => guarded(() => run(ticksDue(pace, performance.now()))), WAKE_MS);
  post({
    type: 'ready',
    from,
    seed: w.seed,
    contentHash,
    width: w.map.width,
    height: w.map.height,
    depth: w.map.levels.length,
    place: (w.entities['colony']?.[0]?.['name'] as string | undefined) ?? w.seed,
    fresh: w.tick === START_TICK,
    people: peopleOf(w),
  });
}

/** Rolls the region of a plain seed and makes each valley's world, to offer them in the picker. */
function offer(seed: string): void {
  const region = regionView(makeRegion(seed, content, true));
  offered = region.valleys.map((v) => createWorld(sim, `${seed}/${v.id}`));
  const valleys = offered.map((w, i) => previewOf(w, i + 1, content));
  post({ type: 'picker', seed, region, valleys }, pickerBuffers(region, valleys));
}

function handle(message: ToWorker): void {
  switch (message.type) {
    case 'init':
      if (message.contentHash !== contentHash)
        throw new Error(
          `The page's content (${message.contentHash}) differs from the worker's (${contentHash}).`,
        );
      // A valley seed begins at once; one naming a valley the region does not have opens its picker.
      if (valleyOf(message.seed, content)) adopt(createWorld(sim, message.seed), 'seed');
      else offer(siteOf(message.seed)?.region ?? message.seed);
      return;
    case 'settle': {
      const chosen = offered[message.site - 1];
      if (!chosen) throw new Error(`No valley ${message.site} is on offer.`);
      offered = [];
      adopt(chosen, 'seed');
      return;
    }
    case 'region': {
      if (!world) return;
      const at = siteOf(world.seed);
      post({
        type: 'region',
        ...(at && { region: regionView(makeRegion(at.region, content, true)) }),
        site: at?.site ?? 0,
      });
      return;
    }
    case 'load': {
      // Checked before anything is replaced: a refused save leaves the running world as it was.
      let loaded: WorldState;
      try {
        loaded = checkSave(message.save, contentHash, content, sim.tables);
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
          ...(message.standby && { standby: true }),
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
          segments: world.segments.map((s) => s.key),
          text: toNdjson(world.log),
        });
      return;
    case 'inspect':
      if (world)
        post({
          type: 'inspected',
          tile: tileView(world, message.x, message.y, message.z ?? 0, lineOf),
        });
      return;
    case 'why':
      if (world)
        post({
          type: 'causes',
          id: message.id,
          lines: whyOf(world, message.id).map(({ event, depth }) => ({
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
    const stopped = world;
    world = undefined;
    offered = [];
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      ...(stopped && { tick: stopped.tick, commands: stopped.commandLog }),
    });
  }
}

onmessage = (e: MessageEvent<ToWorker>) => guarded(() => handle(e.data));
