// The save record and its check. The worker builds a save from the running world and checks one
// before it replaces the running world, so a refused save never touches the game in progress.
import {
  chunksAcross,
  chunksDown,
  type EngineContent,
  type Schemas,
  tablesProblem,
  WATER,
  type WorldState,
} from '../engine/index.ts';

/** Raised when a save's format version changes; older saves need not load before launch. */
export const SAVE_VERSION = 2;

/** One saved game (docs/ARCHITECTURE.md "Save"). The command log and ledger live in `state`;
 * `seed` and `tick` repeat `state`'s as a header readable without walking the world, and
 * `checkSave` requires the two to agree. */
export interface SaveFile {
  version: number;
  seed: string;
  /** New-game settings; none until worldgen options arrive in Phase 1. */
  params: Record<string, string | number>;
  contentHash: string;
  tick: number;
  state: WorldState;
}

/** The save of `world`. It holds the live world by reference: the caller posts it at once, and
 * posting copies it, so the page never holds the running world. */
export const saveOf = (world: WorldState, contentHash: string): SaveFile => ({
  version: SAVE_VERSION,
  seed: world.seed,
  params: {},
  contentHash,
  tick: world.tick,
  state: world,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

/** The world in `save`, or a throw naming why it cannot be loaded with this content. */
export function checkSave(
  save: unknown,
  contentHash: string,
  content: Pick<EngineContent, 'terrain' | 'biomes' | 'features' | 'schools' | 'weather'>,
  tables: Schemas,
): WorldState {
  if (!isObject(save) || !isObject(save['state'])) throw new Error('The save is damaged.');
  if (save['version'] !== SAVE_VERSION)
    throw new Error(
      `It was saved by another version of the game (save format ${String(save['version'])}, this game reads ${SAVE_VERSION}).`,
    );
  if (save['contentHash'] !== contentHash)
    throw new Error(
      `It was made with different game content (${String(save['contentHash'])} in the save, ${contentHash} here).`,
    );
  const state = save['state'];
  const map = state['map'];
  const ok =
    typeof state['seed'] === 'string' &&
    state['seed'] === save['seed'] &&
    isCount(state['tick']) &&
    state['tick'] === save['tick'] &&
    isCount(state['nextEventId']) &&
    isCount(state['nextCommandSeq']) &&
    isCount(state['begunEvent']) &&
    isObject(state['rng']) &&
    isObject(state['systems']) &&
    Array.isArray(state['commandLog']) &&
    Array.isArray(state['pending']) &&
    Array.isArray(state['log']) &&
    Array.isArray(state['stubs']) &&
    Array.isArray(state['segments']) &&
    Array.isArray(state['sealed']) &&
    isObject(state['entities']) &&
    isObject(map) &&
    isCount(map['width']) &&
    isCount(map['height']) &&
    Array.isArray(map['tiles']) &&
    map['tiles'].length === map['width'] * map['height'] &&
    Array.isArray(map['tileCauses']) &&
    map['tileCauses'].length === map['tiles'].length &&
    Array.isArray(map['chunkVersions']) &&
    layer(map['elevation'], Int16Array, map['tiles'].length) &&
    layer(map['biomes'], Uint8Array, map['tiles'].length) &&
    layer(map['fertility'], Uint8Array, map['tiles'].length) &&
    layer(map['features'], Uint8Array, map['tiles'].length) &&
    layer(map['snow'], Uint8Array, map['tiles'].length) &&
    layer(map['water'], Uint8Array, map['tiles'].length) &&
    layer(map['rock'], Uint8Array, map['tiles'].length) &&
    layer(map['aura'], Uint8Array, map['tiles'].length) &&
    layer(map['ice'], Uint8Array, map['tiles'].length) &&
    Number.isSafeInteger(map['floor']) &&
    Array.isArray(map['auraSpots']) &&
    map['auraSpots'].every(isObject) &&
    isCount(map['startX']) &&
    isCount(map['startY']) &&
    Array.isArray(map['levels']) &&
    map['levels'].every(
      (level) => level === null || levelShaped(level, (map['tiles'] as unknown[]).length),
    ) &&
    typeof map['climate'] === 'string' &&
    typeof map['riverExit'] === 'string';
  if (!ok) throw new Error('The save is damaged.');
  const world = state as unknown as WorldState;
  // Deeper checks a matching content hash makes cheap: the map fits the content, and the ledger's
  // ids rise (findEvent's binary search and the next id depend on it).
  const { surface, kinds } = content.terrain;
  const w = world.map;
  let last = 0;
  const sound =
    w.width === surface.width &&
    w.height === surface.height &&
    w.chunkVersions.length === chunksAcross(w) * chunksDown(w) &&
    w.tiles.every((t) => Number.isInteger(t) && t >= 0 && t < kinds.length) &&
    w.startX < w.width &&
    w.startY < w.height &&
    w.biomes.every((b) => b < content.biomes.biomes.length) &&
    w.features.every((f) => f <= content.features.length) &&
    w.water.every((b) => b < WATER.length) &&
    w.rock.every((r) => r <= kinds.length) &&
    // Each aura spot names a school and lies on the map, on the surface or a reached level.
    w.auraSpots.every(
      (s) =>
        content.schools.some((d) => d.id === s.school) &&
        [s.x, s.y, s.z, s.strength].every(isCount) &&
        s.x < w.width &&
        s.y < w.height &&
        (s.z === 0 || w.levels[s.z - 1] != null),
    ) &&
    w.levels.length === content.terrain.generator.underground.depth &&
    // Levels are reached from the top down, so none is made below one that is not.
    w.levels.every(
      (level, k) =>
        level === null ||
        ((k === 0 || w.levels[k - 1] !== null) &&
          level.chunkVersions.length === w.chunkVersions.length &&
          level.chunkVersions.every((v) => Number.isSafeInteger(v) && v >= 1) &&
          level.tiles.every((t) => t < kinds.length) &&
          level.features.every((f) => f <= content.features.length)),
    ) &&
    ['north', 'south', 'east', 'west'].includes(w.riverExit) &&
    // The weather's spell names a known kind; its counters are whole numbers (P1.4).
    weatherSound(world.systems['weather'], content.weather.length) &&
    // Stubs then recent lines, ids rising throughout (findEvent's binary search depends on it).
    world.stubs.every(
      (e) => isObject(e) && isCount(e.id) && e.id > last && ((last = e.id), true),
    ) &&
    ((last = 0), true) &&
    world.log.every((e) => isObject(e) && isCount(e.id) && e.id > last && ((last = e.id), true)) &&
    world.nextEventId > last &&
    world.segments.every((s) => isObject(s) && typeof s.key === 'string' && isCount(s.last)) &&
    world.sealed.every((s) => isObject(s) && typeof s.text === 'string');
  if (!sound) throw new Error('The save is damaged.');
  const tablesWrong = tablesProblem(world, tables);
  if (tablesWrong) throw new Error(`The save is damaged: ${tablesWrong}.`);
  return world;
}

const weatherSound = (state: unknown, kinds: number): boolean =>
  isObject(state) &&
  ['kind', 'temp', 'wet', 'spell', 'frozen', 'over'].every((k) => Number.isSafeInteger(state[k])) &&
  isCount(state['kind']) &&
  (state['kind'] as number) < kinds;

// A generator layer: a typed array of the map's length (structured clones keep the type).
const layer = (
  value: unknown,
  type: typeof Int16Array | typeof Int32Array | typeof Uint8Array,
  length: number,
) => value instanceof type && value.length === length;

// A reached level below: its tiles, causes and features, each one per surface tile.
const levelShaped = (value: unknown, length: number): boolean =>
  isObject(value) &&
  layer(value['tiles'], Uint8Array, length) &&
  layer(value['tileCauses'], Int32Array, length) &&
  layer(value['features'], Uint8Array, length) &&
  Array.isArray(value['chunkVersions']);
