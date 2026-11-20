// The simulation worker: owns the one engine instance, runs it at the chosen speed and answers
// the page. The only place the engine is instantiated (MODULE.md).
import { content, contentHash } from '../content/index.ts';
import {
  applyDue,
  chunksAcross,
  chunksDown,
  chunkTiles,
  createSim,
  createWorld,
  lawHours,
  layerOf,
  makeRegion,
  siteOf,
  START_TICK,
  step,
  valleyOf,
  submitCommand,
  SYSTEMS,
  TEST_TOOLS,
  yesterdayOf,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import {
  createPace,
  jump,
  jumpDone,
  react,
  setSpeed,
  SKIP_MS,
  skipEnds,
  stopSkip,
  ticksDue,
} from './pace.ts';
import { actOf, landing, landingsOf, stopSettings } from './stops.ts';
import { createTiming, recordTick, timedSystems } from './timing.ts';
import type { ChunkView, FromWorker, LedgerLine, ToWorker } from './protocol.ts';
import type { JumpView, StopAct } from './protocol-time.ts';
import { pickerBuffers, previewOf, regionView } from './region.ts';
import { checkSave } from './save.ts';
import { ANSWERS, isRead } from './answers.ts';
import { lineOf } from './lines.ts';
import { buildView } from './build.ts';
import { goodsOf, stockView } from './goods.ts';
import { lawsOf } from './strangers.ts';
import { miningShown } from './mine.ts';
import { peopleFeed, peopleOf, walkersOf } from './people.ts';
import { withLying } from './places.ts';
import { sunOf } from './lampview.ts';
import { clockView, greenOf, weatherOf } from './views.ts';
import { animalFeed, leftoversView } from './wild.ts';

/** How often the worker wakes (ms). Timing comes from the clock, not from this interval. */
const WAKE_MS = 10;
/** A wake runs its owed ticks for at most this long (ms): a device that can't keep up with a fast
 * speed runs as fast as it can and still answers the page between wakes. */
const RUN_MS = 40;

const timing = createTiming(SYSTEMS.length);
const sim = createSim(
  content,
  timedSystems(SYSTEMS, timing, () => performance.now()),
);
const systemNames = SYSTEMS.map((s) => s.id);
let world: WorldState | undefined;
/** The page's test mode: test tools are applied only when it is on. */
let testMode = false;
let pace = createPace(performance.now());
/** What each stop kind does (V-191), the content defaults until the page sends its own. */
let stops = stopSettings();
/** Chunk versions the page has already been sent, per level; empty until the first snapshot. */
let sent: number[][] = [];
/** The Build view last sent, as JSON; empty until the first snapshot. */
let sentBuild = '';
/** Everyone goes out again when someone comes, stays or leaves (P5.9). */
const peopleSent = peopleFeed();
/** The animals go out only when one has moved. */
const animals = animalFeed();
/** Ledger lines written since the last snapshot, collected as they are written: sealing trims
 * the log's front, so a long run could otherwise seal lines before they were posted. */
let unposted: SimEvent[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
/** A snapshot owed to the levers just sent, one for the whole burst. */
let snapSoon: ReturnType<typeof setTimeout> | undefined;
/** The valleys on offer in the picker, made from their seeds and not yet run. */
let offered: WorldState[] = [];

const post = (message: FromWorker, transfer: Transferable[] = []): void =>
  postMessage(message, { transfer });

/** Runs one tick, timed, and collects its lines (sealing trims the log's front at midnight);
 * returns what the strongest of its notable lines asks of the clock (V-191). */
function tickOnce(w: WorldState): StopAct | undefined {
  const start = performance.now();
  const lines = step(w, sim, 1);
  unposted.push(...lines);
  recordTick(timing, performance.now() - start, systemNames);
  return actOf(lines, sim.notable, stops);
}

/** Runs `ticks` ticks (for at most `RUN_MS`), or, jumping ahead, as many as fit in `SKIP_MS`; then
 * hands the days sealed meanwhile to the page to archive, so a save never carries them. */
function run(ticks: number): void {
  const w = world;
  if (!w) return;
  if (pace.skip) {
    // Tick by tick, exactly as at any speed, so a jump writes the ledger a 3x run would.
    const until = performance.now() + SKIP_MS;
    while (pace.skip && performance.now() < until) {
      const act = tickOnce(w);
      if (skipEnds(pace, w.tick, act)) stopSkip(pace);
    }
  } else {
    const until = performance.now() + RUN_MS;
    for (let i = 0; i < ticks && performance.now() < until; i += 1)
      if (react(pace, tickOnce(w))) break;
  }
  if (w.sealed.length) {
    post({ type: 'segments', items: w.sealed.map(({ key, text }) => ({ key, text })) });
    w.sealed = [];
  }
}

/** The jump under way: where it lands and how far it has come. */
function jumpView(tick: number): JumpView {
  const span = pace.span ?? 'next';
  const done = jumpDone(pace, tick);
  const to = span === 'next' ? 'the next event' : landingsOf(pace.from ?? tick)[span];
  return { span, to, ...(done !== undefined && { done }) };
}

/** Line `e` for the page, as the running world sees it. */
const line = (e: SimEvent | Stub): LedgerLine => lineOf(world, sim, e);

function snapshot(w: WorldState): void {
  const yesterday = yesterdayOf(w, content);
  // The Build view goes out only when it changes, like the chunks.
  const now = buildView(w);
  const key = JSON.stringify(now);
  const build = key === sentBuild ? undefined : now;
  sentBuild = key;
  const people = peopleSent.next(w);
  const moved = animals.next(w);
  if (unposted.length) {
    post({ type: 'events', batch: unposted.map(line) });
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
        chunks.push(chunkTiles(w.map, cx, cy, z, w.tick));
      }
  }
  post(
    {
      type: 'snapshot',
      tick: w.tick,
      at: pace.last,
      speed: pace.speed,
      skipping: pace.skip,
      ...(pace.span && { jump: jumpView(w.tick) }),
      landings: landingsOf(w.tick),
      day: { ...lawHours(w, content), ...sunOf(w.tick) },
      law: lawsOf(w),
      clock: clockView(w.tick),
      chunks,
      reached: w.map.levels.map((level) => level !== null),
      weather: weatherOf(w),
      aura: w.map.auraSpots.map(({ school, x, y, z, strength }) => ({ school, x, y, z, strength })),
      timing: timing.view,
      walkers: withLying(w, walkersOf(w)),
      ...(moved && { animals: moved }),
      leftovers: leftoversView(w),
      goods: goodsOf(w),
      stock: stockView(w),
      mining: miningShown(w),
      ...(build && { build }),
      ...(people && { people }),
      ...(yesterday && { yesterday }),
    },
    chunks.flatMap((c) => [
      ...[c.tiles.buffer, c.features.buffer, c.snow.buffer, c.ice.buffer],
      ...[c.snowLie.buffer, c.printKind.buffer, c.printAge.buffer, c.printDir.buffer],
      c.worn.buffer,
    ]),
  );
}

/** Makes `w` the running world, paused, with everything sent afresh. `init` and `load` both end
 * here, so a loaded world and a new one start the same way. */
function adopt(w: WorldState, from: 'seed' | 'save'): void {
  world = w;
  sent = [];
  sentBuild = '';
  peopleSent.next(w);
  animals.reset();
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
    ...greenOf(w, sim.templates),
  });
}

/** Rolls the region of a plain seed and makes each valley's world, to offer them in the picker. */
function offer(seed: string): void {
  const region = regionView(makeRegion(seed, content, true));
  offered = region.valleys.map((v) => createWorld(sim, `${seed}/${v.id}`));
  const valleys = offered.map((w, i) => previewOf(w, i + 1, content));
  post({ type: 'picker', seed, region, valleys }, pickerBuffers(region, valleys));
}

type Control = Exclude<ToWorker, { type: AnswerType }>;
type AnswerType = keyof typeof ANSWERS;
/** What each message that steers the worker does; the read-only ones are answers.ts's. */
const CONTROLS: { [K in Control['type']]: (m: Extract<Control, { type: K }>) => void } = {
  init(m) {
    if (m.contentHash !== contentHash)
      throw new Error(
        `The page's content (${m.contentHash}) differs from the worker's (${contentHash}).`,
      );
    // A valley seed begins at once; one naming a valley the region does not have opens its picker.
    if (valleyOf(m.seed, content)) adopt(createWorld(sim, m.seed), 'seed');
    else offer(siteOf(m.seed)?.region ?? m.seed);
  },
  settle(m) {
    const chosen = offered[m.site - 1];
    if (!chosen) throw new Error(`No valley ${m.site} is on offer.`);
    offered = [];
    adopt(chosen, 'seed');
  },
  region() {
    if (!world) return;
    const at = siteOf(world.seed);
    post({
      type: 'region',
      ...(at && { region: regionView(makeRegion(at.region, content, true)) }),
      site: at?.site ?? 0,
    });
  },
  load(m) {
    // Checked before anything is replaced: a refused save leaves the running world as it was.
    let loaded: WorldState;
    try {
      loaded = checkSave(m.save, contentHash, content, sim.tables);
    } catch (error) {
      post({ type: 'loadRefused', reason: error instanceof Error ? error.message : String(error) });
      return;
    }
    adopt(loaded, 'save');
  },
  setSpeed: (m) => run(setSpeed(pace, m.speed, performance.now())),
  setStops(m) {
    stops = stopSettings(m.stops);
  },
  lookAgain() {
    // Only on arrival and only once: the same seed made again with the band's second choice.
    if (world && greenOf(world, sim.templates).green?.again)
      adopt(createWorld(sim, world.seed, 1), 'seed');
  },
  jump(m) {
    // For everyone since V-191: the player's clock, not a lever. Every tick runs on the way.
    if (!world) return;
    jump(pace, m.span, world.tick, m.span === 'next' ? undefined : landing(world.tick, m.span));
  },
  requestSnapshot() {
    if (world) snapshot(world);
  },
  testMode(m) {
    testMode = m.on;
  },
  command(m) {
    if (!world) throw new Error('A command arrived before the world began.');
    // A test tool from a page not in test mode is dropped before the command log (V-041).
    if (!testMode && TEST_TOOLS.includes(m.kind)) return;
    submitCommand(world, m);
    // Paused, a lever takes effect at once (stamped for the next tick, as it would apply), and
    // the page sees it now rather than once time runs.
    if (pace.speed === 0 && !pace.skip) {
      unposted.push(...applyDue(world, sim));
      // One snapshot for a burst of levers (a heading's stepper sends a command per row).
      snapSoon ??= setTimeout(() => {
        snapSoon = undefined;
        if (world) guarded(() => snapshot(world!));
      }, 0);
    }
  },
};

function handle(message: ToWorker): void {
  if (isRead(message)) {
    // These only read the world, between ticks; with no world (stopped) they go unanswered.
    const answer = ANSWERS[message.type] as (
      w: WorldState,
      m: ToWorker,
      l: typeof line,
    ) => FromWorker;
    if (world) post(answer(world, message, line));
    return;
  }
  (CONTROLS[message.type] as ((m: Control) => void) | undefined)?.(message);
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
