// The simulation worker: owns the one engine instance, runs it at the chosen speed and answers
// the page. The only place the engine is instantiated (MODULE.md).
import { asksView } from './asksview.ts';
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
  neighboursOf,
  siteOf,
  START_TICK,
  valleyOf,
  submitCommand,
  SYSTEMS,
  TEST_TOOLS,
  yesterdayOf,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { createPace, jump, jumpDone, setSpeed, SKIP_MS, ticksDue } from './pace.ts';
import { cutJump, runTicks, type Clock } from './clock.ts';
import { landing, landingsOf, stopSettings } from './stops.ts';
import { recapFeed } from './recaps.ts';
import { createTiming, recordTick, timedSystems } from './timing.ts';
import type { ChunkView, FromWorker, LedgerLine, ToWorker } from './protocol.ts';
import type { JumpEndView, JumpSpan, JumpView } from './protocol-time.ts';
import { pickerBuffers, previewOf, regionView } from './region.ts';
import { checkSave, OtherVersion } from './save.ts';
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
import { findFeed, knownFeed } from './finds.ts';

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
/** The clock: its pace; what each stop kind does (V-191), the content defaults until the page
 * sends its own; which recaps pause play at a running speed, both until the page says otherwise;
 * and how the last jump ended, until a snapshot tells the page. */
const clock: Clock = {
  pace: createPace(performance.now()),
  stops: stopSettings(),
  recaps: { season: true, year: true },
};
/** Each recap goes to the page once. */
const recapsSent = recapFeed();
/** Chunk versions the page has already been sent, per level; empty until the first snapshot. */
let sent: number[][] = [];
/** The Build view last sent, as JSON; empty until the first snapshot. */
let sentBuild = '';
/** Everyone goes out again when someone comes, stays or leaves (P5.9). */
const peopleSent = peopleFeed();
/** The animals go out only when one has moved. */
const animals = animalFeed();
/** Surface chunks go out again as known land grows; the flags only when they change (6W S6). */
const knownSent = knownFeed();
const findsSent = findFeed();
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

/** Runs `ticks` ticks (for at most `RUN_MS`), or, jumping ahead, as many as fit in `SKIP_MS`, each
 * timed, collecting their lines (sealing trims the log's front at midnight); then hands the days
 * sealed meanwhile to the page to archive, so a save never carries them. */
function run(ticks: number): void {
  const w = world;
  if (!w) return;
  let at = performance.now();
  const until = at + (clock.pace.skip ? SKIP_MS : RUN_MS);
  runTicks(
    w,
    sim,
    clock,
    ticks,
    () => performance.now() < until,
    (lines) => {
      unposted.push(...lines);
      const now = performance.now();
      recordTick(timing, now - at, systemNames);
      at = now;
    },
  );
  if (w.sealed.length) {
    post({ type: 'segments', items: w.sealed.map(({ key, text }) => ({ key, text })) });
    w.sealed = [];
  }
}

/** The jump under way: where it lands and how far it has come. */
function jumpView(tick: number): JumpView {
  const { pace } = clock;
  const span = pace.span ?? 'next';
  const done = jumpDone(pace, tick);
  return { span, to: landsAt(span, pace.from ?? tick), ...(done !== undefined && { done }) };
}

const landsAt = (span: JumpSpan, from: number): string =>
  span === 'next' ? 'the next event' : landingsOf(from)[span];

/** How the last jump ended, once: the page opens the recaps it passed only if it landed. */
function jumpEndView(): JumpEndView | undefined {
  const ended = clock.ended;
  if (!ended) return undefined;
  delete clock.ended;
  const { span, from, landed, line: stopped } = ended;
  return { span, to: landsAt(span, from), landed, ...(stopped && { line: line(stopped) }) };
}

/** Line `e` for the page, as the running world sees it. */
const line = (e: SimEvent | Stub): LedgerLine => lineOf(world, sim, e);

/** Chunks changed since they were last sent, on every reached level; a surface chunk also when
 * its known land grew (6W Slice 6). */
function changedChunks(w: WorldState): ChunkView[] {
  const chunks: ChunkView[] = [];
  const across = chunksAcross(w.map);
  const grown = knownSent.grown(w.map, w.tick);
  for (let z = 0; z <= w.map.levels.length; z += 1) {
    const layer = layerOf(w.map, z);
    if (!layer) continue;
    const seen = (sent[z] ??= []);
    for (let cy = 0; cy < chunksDown(w.map); cy += 1)
      for (let cx = 0; cx < across; cx += 1) {
        const i = cy * across + cx;
        if (seen[i] === layer.chunkVersions[i] && !(z === 0 && grown.has(i))) continue;
        seen[i] = layer.chunkVersions[i]!;
        chunks.push(chunkTiles(w.map, cx, cy, z, w.tick));
      }
  }
  return chunks;
}

function snapshot(w: WorldState): void {
  const yesterday = yesterdayOf(w, content);
  // The Build view goes out only when it changes, like the chunks.
  const now = buildView(w);
  const key = JSON.stringify(now);
  const build = key === sentBuild ? undefined : now;
  sentBuild = key;
  const people = peopleSent.next(w);
  const moved = animals.next(w);
  const annals = recapsSent.next(w, line);
  const jumpEnd = jumpEndView();
  if (unposted.length) {
    post({ type: 'events', batch: unposted.map(line) });
    unposted = [];
  }
  const chunks = changedChunks(w);
  const finds = findsSent.next(w);
  post(
    {
      type: 'snapshot',
      tick: w.tick,
      at: clock.pace.last,
      speed: clock.pace.speed,
      skipping: clock.pace.skip,
      ...(clock.pace.span && { jump: jumpView(w.tick) }),
      ...(jumpEnd && { jumpEnd }),
      landings: landingsOf(w.tick),
      day: { ...lawHours(w, content), ...sunOf(w.tick) },
      law: lawsOf(w),
      asks: asksView(w, line),
      clock: clockView(w.tick),
      chunks,
      reached: w.map.levels.map((level) => level !== null),
      weather: weatherOf(w),
      aura: w.map.auraSpots.map(({ school, x, y, z, strength }) => ({ school, x, y, z, strength })),
      timing: timing.view,
      walkers: withLying(w, walkersOf(w)),
      ...(moved && { animals: moved }),
      ...(finds && { finds }),
      leftovers: leftoversView(w),
      goods: goodsOf(w),
      stock: stockView(w),
      mining: miningShown(w),
      ...(build && { build }),
      ...(people && { people }),
      ...(yesterday && { yesterday }),
      ...(annals && { annals }),
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
  knownSent.reset();
  findsSent.reset();
  recapsSent.reset();
  unposted = [...w.log];
  // The neighbours come from the seed's Story Generator world, made once a worker (2.7 s here,
  // 6 to 8 s on a loaded machine). A loaded save has not made it yet: made now, while the page
  // shows the load, not at the strangers' first hour, which froze play (the smoke, 2026-11-25).
  neighboursOf(w.seed, content);
  clock.pace = createPace(performance.now());
  delete clock.ended;
  run(0); // hands over any sealed days the world arrived with (never ticks: the pace is fresh)
  timer ??= setInterval(() => guarded(() => run(ticksDue(clock.pace, performance.now()))), WAKE_MS);
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
      const reason = error instanceof Error ? error.message : String(error);
      post({ type: 'loadRefused', reason, old: error instanceof OtherVersion });
      return;
    }
    adopt(loaded, 'save');
  },
  setSpeed(m) {
    if (world) cutJump(clock, world.tick);
    run(setSpeed(clock.pace, m.speed, performance.now()));
  },
  setStops(m) {
    clock.stops = stopSettings(m.stops);
  },
  setRecaps(m) {
    clock.recaps = { season: m.recaps.season === true, year: m.recaps.year === true };
  },
  lookAgain() {
    // Only on arrival and only once: the same seed made again with the band's second choice.
    if (world && greenOf(world, sim.templates).green?.again)
      adopt(createWorld(sim, world.seed, 1), 'seed');
  },
  jump(m) {
    // For everyone since V-191: the player's clock, not a lever. Every tick runs on the way.
    if (!world) return;
    delete clock.ended;
    jump(
      clock.pace,
      m.span,
      world.tick,
      m.span === 'next' ? undefined : landing(world.tick, m.span),
    );
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
    if (clock.pace.speed === 0 && !clock.pace.skip) {
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
