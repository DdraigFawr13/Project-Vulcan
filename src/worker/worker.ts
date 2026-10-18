// The simulation worker: owns the one engine instance, runs it at the chosen speed and answers
// the page. The only place the engine is instantiated (MODULE.md).
import { content, contentHash } from '../content/index.ts';
import {
  allLines,
  auraAt,
  CHUNK,
  chunksAcross,
  chunksDown,
  chunkTiles,
  clockAt,
  createSim,
  createWorld,
  isFrozen,
  layerOf,
  makeRegion,
  recordOf,
  renderEvent,
  siteOf,
  step,
  valleyOf,
  submitCommand,
  TICKS_PER_DAY,
  tileTemperature,
  toNdjson,
  whyOf,
  type SimEvent,
  type Stub,
  type WorldState,
  WATER,
  weatherWords,
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
import { pickerBuffers, previewOf, regionView } from './region.ts';
import { checkSave, saveOf } from './save.ts';

/** How often the worker wakes (ms). Timing comes from the clock, not from this interval. */
const WAKE_MS = 10;

const sim = createSim(content);
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

function run(ticks: number): void {
  // A day at a time, well inside the week the log keeps, so every line written is collected.
  for (let left = ticks; world && left > 0; left -= TICKS_PER_DAY)
    for (const line of step(world, sim, Math.min(left, TICKS_PER_DAY))) unposted.push(line);
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
      at: performance.now(),
      speed: pace.speed,
      clock: clockView(w.tick),
      chunks,
      reached: w.map.levels.map((level) => level !== null),
      weather: weatherOf(w),
      aura: w.map.auraSpots.map(({ school, x, y, z, strength }) => ({ school, x, y, z, strength })),
    },
    chunks.flatMap((c) => [c.tiles.buffer, c.features.buffer, c.snow.buffer, c.ice.buffer]),
  );
}

/** Today's weather from the weather system's state. */
function weatherOf(w: WorldState): { words: string; temperature: number } {
  const state = w.systems['weather'] ?? {};
  const temperature = state['temp'] ?? 0;
  return { words: weatherWords(content, state['kind'] ?? 0, temperature), temperature };
}

/** The inspector's temperature, ice and aura rows for surface tile `i` (aura on any level). */
function climateOf(w: WorldState, x: number, y: number, z: number): Partial<TileView> {
  const { map } = w;
  const i = y * map.width + x;
  const { aura, spot } = auraAt(content, map, x, y, z);
  const site = spot && content.terrain.generator.aura.sites.find((s) => s.site === spot.site);
  const school = spot && content.schools.find((s) => s.id === spot.school);
  return {
    ...(z === 0 && {
      temperature: tileTemperature(content, map, w.systems['weather']?.['temp'] ?? 0, i),
    }),
    ...(z === 0 && WATER[map.water[i]!] === 'lake' && { ice: iceOf(w, i) }),
    ...((aura > 0 || spot) && {
      aura: spot ? `${aura}, ${school?.name} (a spot: ${site?.words})` : `${aura} (faint)`,
    }),
  };
}

/** A lake tile's ice, and since when, from the ice line its freezing cites (tileCauses). */
function iceOf(w: WorldState, i: number): string {
  const line = recordOf(w, w.map.tileCauses[i]!);
  const since = line?.type.startsWith('weather.') ? clockView(line.tick) : undefined;
  const date = since && ` since Day ${since.day} of ${since.monthName}`;
  return isFrozen(w.map, i)
    ? `frozen over${date ?? ''}`
    : `open water${date ? `, thawed${date}` : ''}`;
}

const itemName = (id: string): string => content.items.find((item) => item.id === id)?.name ?? id;

/** Tile (x, y) on level `z` for the inspector; undefined off the map or on an unreached level. */
function tileView(w: WorldState, x: number, y: number, z: number): TileView | undefined {
  const { map } = w;
  if (![x, y, z].every(Number.isInteger) || x < 0 || y < 0) return undefined;
  if (x >= map.width || y >= map.height) return undefined;
  const layer = z >= 0 ? layerOf(map, z) : undefined;
  if (!layer) return undefined;
  const chunkX = Math.floor(x / CHUNK);
  const chunkY = Math.floor(y / CHUNK);
  const i = y * map.width + x;
  const changedBy = recordOf(w, layer.tileCauses[i]!);
  const feature = layer.features[i]! > 0 ? content.features[layer.features[i]! - 1] : undefined;
  const snowy = z === 0 && map.snow[i] === 1;
  const under = z < map.levels.length ? layerOf(map, z + 1) : undefined;
  return {
    x,
    y,
    z,
    ground: `${content.terrain.kinds[layer.tiles[i]!]!.name}${snowy ? ', snow-capped' : ''}`,
    ...(z === 0 && {
      biome: content.biomes.biomes[map.biomes[i]!]!.name,
      elevation: map.elevation[i]!,
      fertility: map.fertility[i]!,
    }),
    ...(z < map.levels.length && {
      below: under
        ? `${content.terrain.kinds[under.tiles[i]!]!.name} (level ${z + 1})`
        : `level ${z + 1}, not reached`,
    }),
    ...waterOf(map, layer.tiles[i]!, z === 0 ? map.water[i]! : 0),
    ...climateOf(w, x, y, z),
    ...(feature && { feature: `${feature.name} (${feature.amount} ${itemName(feature.yields)})` }),
    ...waysOf(map, i, z),
    chunkX,
    chunkY,
    version: layer.chunkVersions[chunkY * chunksAcross(map) + chunkX]!,
    ...(changedBy && { changedBy: lineOf(changedBy) }),
  };
}

/** Whether stairs or a shaft on tile `i` of level `z` lead up or down to a reached level. A shaft
 * leads on only where the shaft continues on the next level. */
function waysOf(map: WorldState['map'], i: number, z: number): Partial<TileView> {
  const dials = content.terrain.generator.underground;
  const id = (level: number): string | undefined => {
    const layer = level >= 0 ? layerOf(map, level) : undefined;
    return layer && content.terrain.kinds[layer.tiles[i]!]!.id;
  };
  const here = id(z);
  const down =
    id(z + 1) !== undefined &&
    (here === dials.stairsDown ||
      here === dials.stairs ||
      (here === dials.shaft && id(z + 1) === dials.shaft));
  const up =
    z > 0 &&
    (here === dials.stairsUp ||
      here === dials.stairs ||
      (here === dials.shaft && id(z - 1) === dials.shaft));
  return down || up ? { ways: { up, down } } : {};
}

const BODIES: Record<Exclude<(typeof WATER)[number], ''>, (exit: string) => string> = {
  stream: () => 'a stream',
  river: (exit) => `the river, flowing to the ${exit} edge`,
  lake: () => 'a lake',
  spring: () => 'a spring, the head of a stream',
};

/** The inspector's water rows for a tile of terrain `tile` in water body `code`: none on dry
 * land; groundwater below belongs to no body. */
function waterOf(map: WorldState['map'], tile: number, code: number): Partial<TileView> {
  const kind = content.terrain.kinds[tile]!;
  if (!kind.water) return {};
  const body = WATER[code];
  return {
    ...(body && { water: BODIES[body]!(map.riverExit) }),
    drinkable: kind.drinkable === true,
    crossing: kind.water === 'deep' ? 'too deep to cross' : 'can be waded',
  };
}

/** Makes `w` the running world, paused, with everything sent afresh. `init` and `load` both end
 * here, so a loaded world and a new one start the same way. */
function adopt(w: WorldState, from: 'seed' | 'save'): void {
  world = w;
  sent = [];
  unposted = [...w.log];
  pace = createPace(performance.now());
  timer ??= setInterval(() => guarded(() => run(ticksDue(pace, performance.now()))), WAKE_MS);
  post({
    type: 'ready',
    from,
    seed: w.seed,
    contentHash,
    width: w.map.width,
    height: w.map.height,
    depth: w.map.levels.length,
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
          text: toNdjson(allLines(world)),
        });
      return;
    case 'inspect':
      if (world)
        post({
          type: 'inspected',
          tile: tileView(world, message.x, message.y, message.z ?? 0),
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
    world = undefined;
    offered = [];
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}

onmessage = (e: MessageEvent<ToWorker>) => guarded(() => handle(e.data));
