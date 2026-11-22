// The save check's parts (save.ts `checkSave`): the shape a structured clone must keep, then the
// deeper checks a matching content hash makes cheap. Each part is one list of checks, so a new
// table or layer adds a row here rather than a branch in `checkSave`.
import {
  chunksAcross,
  chunksDown,
  type EngineContent,
  type EntityRow,
  SHAFT_STATES,
  WATER,
  type WorldState,
} from '../engine/index.ts';

/** The content a save is checked against. */
export type SaveContent = Pick<
  EngineContent,
  'terrain' | 'biomes' | 'features' | 'schools' | 'weather' | 'buildings'
>;

type Shape = Record<string, unknown>;
type Layer = typeof Int16Array | typeof Int32Array | typeof Uint8Array | typeof Uint16Array;

export const isObject = (v: unknown): v is Shape =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

// A generator layer: a typed array of the map's length (structured clones keep the type).
const layer = (value: unknown, type: Layer, length: number) =>
  value instanceof type && value.length === length;

/** The map's generator layers, each one per tile. */
const LAYERS: readonly (readonly [string, Layer])[] = [
  ['elevation', Int16Array],
  ['biomes', Uint8Array],
  ['fertility', Uint8Array],
  ['features', Uint8Array],
  ['snow', Uint8Array],
  ['water', Uint8Array],
  ['rock', Uint8Array],
  ['aura', Uint8Array],
  ['ice', Uint8Array],
  ['snowLie', Uint8Array],
  ['printKind', Uint8Array],
  ['printAt', Int32Array],
  ['printDir', Uint8Array],
  ['wear', Uint16Array],
  ['worn', Uint8Array],
  ['built', Uint8Array],
  ['stains', Uint8Array],
  ['known', Uint8Array],
];

/** The world's own fields that are counts, and those that are lists. */
const COUNTS = ['nextEventId', 'nextCommandSeq', 'begunEvent'];
const LISTS = ['commandLog', 'pending', 'log', 'stubs', 'segments', 'sealed'];

/** True when the saved state has the world's shape and its header agrees with the save's. */
export const stateShaped = (state: Shape, save: Shape): boolean =>
  typeof state['seed'] === 'string' &&
  state['seed'] === save['seed'] &&
  isCount(state['tick']) &&
  state['tick'] === save['tick'] &&
  COUNTS.every((k) => isCount(state[k])) &&
  isObject(state['rng']) &&
  isObject(state['systems']) &&
  LISTS.every((k) => Array.isArray(state[k])) &&
  isObject(state['entities']) &&
  mapShaped(state['map']);

function mapShaped(map: unknown): boolean {
  if (!isObject(map) || !isCount(map['width']) || !isCount(map['height'])) return false;
  const tiles = map['tiles'];
  if (!(tiles instanceof Uint8Array) || tiles.length !== map['width'] * map['height']) return false;
  return layersShaped(map, tiles.length) && placesShaped(map, tiles.length);
}

/** The tile causes, chunk versions and generator layers, each the map's length. */
const layersShaped = (map: Shape, n: number): boolean =>
  layer(map['tileCauses'], Int32Array, n) &&
  Array.isArray(map['chunkVersions']) &&
  LAYERS.every(([k, type]) => layer(map[k], type, n)) &&
  Number.isSafeInteger(map['floor']);

/** The aura spots, the start, the levels below, the climate and where the river leaves. */
const placesShaped = (map: Shape, n: number): boolean =>
  Array.isArray(map['auraSpots']) &&
  map['auraSpots'].every(isObject) &&
  isCount(map['startX']) &&
  isCount(map['startY']) &&
  Array.isArray(map['levels']) &&
  map['levels'].every((level) => level === null || levelShaped(level, n)) &&
  typeof map['climate'] === 'string' &&
  typeof map['riverExit'] === 'string' &&
  isObject(map['riches']) &&
  Array.isArray(map['regrow']) &&
  map['regrow'].length % 3 === 0 &&
  Array.isArray(map['finds']) &&
  map['finds'].every(findShaped);

// A scouting trip (V-204): where, the good, the count (-1 while under way), its line and tick.
const findShaped = (f: unknown): boolean =>
  isObject(f) &&
  typeof f['good'] === 'string' &&
  [f['x'], f['y'], f['who'], f['line'], f['tick']].every(isCount) &&
  Number.isSafeInteger(f['count']) &&
  (f['count'] as number) >= -1;

// A reached level below: its tiles, causes and features, each one per surface tile.
const levelShaped = (value: unknown, length: number): boolean =>
  isObject(value) &&
  layer(value['tiles'], Uint8Array, length) &&
  layer(value['tileCauses'], Int32Array, length) &&
  layer(value['features'], Uint8Array, length) &&
  layer(value['known'], Uint8Array, length) &&
  Array.isArray(value['chunkVersions']);

/** True when the map, its levels and rows fit the content, and the ledger's ids rise
 * (findEvent's binary search and the next id depend on it). */
export const fitsContent = (world: WorldState, content: SaveContent): boolean =>
  mapFits(world, content) &&
  rowsFit(world, content) &&
  levelsFit(world, content) &&
  shaftsFit(world) &&
  ['north', 'south', 'east', 'west'].includes(world.map.riverExit) &&
  // The weather's spell names a known kind; its counters are whole numbers (P1.4).
  weatherSound(world.systems['weather'], content.weather.length) &&
  ledgerSound(world);

function mapFits(world: WorldState, content: SaveContent): boolean {
  const { surface, kinds } = content.terrain;
  const w = world.map;
  const features = content.features.length;
  return (
    w.width === surface.width &&
    w.height === surface.height &&
    w.chunkVersions.length === chunksAcross(w) * chunksDown(w) &&
    w.tiles.every((t) => Number.isInteger(t) && t >= 0 && t < kinds.length) &&
    w.startX < w.width &&
    w.startY < w.height &&
    w.biomes.every((b) => b < content.biomes.biomes.length) &&
    w.features.every((f) => f <= features) &&
    w.built.every((b) => b <= content.buildings.parts.length) &&
    // Ore stains name a feature (V-087).
    w.stains.every((f) => f <= features) &&
    // Known land is 0, 1 or a scout's 2 (V-204); only the last trip may be under way.
    w.known.every((k) => k <= 2) &&
    w.finds.every(
      (f, k) => f.x < w.width && f.y < w.height && (f.count >= 0 || k === w.finds.length - 1),
    ) &&
    regrowFits(w.regrow, w.width * w.height, features)
  );
}

/** Felled trees to grow back (V-202): triples of a tile on the map, a feature and a due day, the
 * days never falling (regrowWoods reads them from the front). */
function regrowFits(regrow: readonly number[], tiles: number, features: number): boolean {
  for (let k = 0; k < regrow.length; k += 3) {
    const [i, f, day] = [regrow[k], regrow[k + 1], regrow[k + 2]];
    if (!isCount(i) || i >= tiles || !isCount(f) || f < 1 || f > features || !isCount(day))
      return false;
    if (k && day < regrow[k - 1]!) return false;
  }
  return true;
}

/** Each plan is of a known part, on the map and in a known state (P3.1); water and rock are
 * known kinds; each aura spot names a school and lies on the map, on the surface or a reached
 * level. */
function rowsFit(world: WorldState, content: SaveContent): boolean {
  const w = world.map;
  const planFits = (r: EntityRow) =>
    content.buildings.parts.some((p) => p.id === r['part']) &&
    ['plan', 'built', 'down'].includes(r['state'] as string) &&
    (r['x'] as number) < w.width &&
    (r['y'] as number) < w.height;
  return (
    (world.entities['plan'] ?? []).every(planFits) &&
    w.water.every((b) => b < WATER.length) &&
    w.rock.every((r) => r <= content.terrain.kinds.length) &&
    w.auraSpots.every(
      (s) =>
        content.schools.some((d) => d.id === s.school) &&
        [s.x, s.y, s.z, s.strength].every(isCount) &&
        s.x < w.width &&
        s.y < w.height &&
        (s.z === 0 || w.levels[s.z - 1] != null),
    )
  );
}

/** Levels are reached from the top down, so none is made below one that is not. */
function levelsFit(world: WorldState, content: SaveContent): boolean {
  const w = world.map;
  const { kinds } = content.terrain;
  return (
    w.levels.length === content.terrain.generator.underground.depth &&
    w.levels.every(
      (level, k) =>
        level === null ||
        ((k === 0 || w.levels[k - 1] !== null) &&
          level.chunkVersions.length === w.chunkVersions.length &&
          level.chunkVersions.every((v) => Number.isSafeInteger(v) && v >= 1) &&
          level.tiles.every((t) => t < kinds.length) &&
          level.features.every((f) => f <= content.features.length) &&
          level.known.every((k) => k <= 1)),
    )
  );
}

/** Each shaft is in a known state, sunk no deeper than its vein's level, which is a level there
 * is (P4.1). */
const shaftsFit = (world: WorldState): boolean =>
  (world.entities['shaft'] ?? []).every(
    (r) =>
      SHAFT_STATES.includes(r['state'] as (typeof SHAFT_STATES)[number]) &&
      (r['depth'] as number) <= (r['to'] as number) &&
      (r['to'] as number) <= world.map.levels.length,
  );

const weatherSound = (state: unknown, kinds: number): boolean =>
  isObject(state) &&
  ['kind', 'temp', 'wet', 'spell', 'frozen', 'over'].every((k) => Number.isSafeInteger(state[k])) &&
  isCount(state['kind']) &&
  (state['kind'] as number) < kinds;

/** Stubs (a kept line with its causes, V-177) then recent lines, ids rising throughout; days sealed and archived are well formed. */
function ledgerSound(world: WorldState): boolean {
  let last = 0;
  const rises = (id: number) => id > last && ((last = id), true);
  return (
    world.stubs.every(
      (e) =>
        isObject(e) &&
        isCount(e.id) &&
        isCount(e.tick) &&
        typeof e.type === 'string' &&
        (!('causes' in e) || (Array.isArray(e.causes) && e.causes.every(isCount))) &&
        rises(e.id),
    ) &&
    world.log.every((e) => isObject(e) && isCount(e.id) && rises(e.id)) &&
    world.nextEventId > last &&
    world.segments.every(
      (s) =>
        isObject(s) &&
        typeof s.key === 'string' &&
        [s.day, s.first, s.last].every(isCount) &&
        s.first <= s.last,
    ) &&
    world.sealed.every((s) => isObject(s) && typeof s.text === 'string')
  );
}
