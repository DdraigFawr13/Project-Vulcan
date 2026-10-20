// The inspector's views of the running world: the clock, today's weather and one tile. Pure
// reads of the world and content, kept apart from the worker's loop (MODULE.md).
import { content } from '../content/index.ts';
import {
  auraAt,
  CHUNK,
  chunksAcross,
  clockAt,
  feltAt,
  isFrozen,
  layerOf,
  recordOf,
  type MapState,
  type SimEvent,
  type Stub,
  type WorldState,
  WATER,
  weatherWords,
} from '../engine/index.ts';
import { tileHouse } from './build.ts';
import { tileField } from './fields.ts';
import { tileGoods } from './goods.ts';
import { tileShaft } from './mine.ts';
import { tileWild } from './wild.ts';
import { tilePlace } from './places.ts';
import type { ClockView, LedgerLine, TileView } from './protocol.ts';

export function clockView(tick: number): ClockView {
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

/** Today's weather from the weather system's state. */
export function weatherOf(w: WorldState): { words: string; temperature: number } {
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
      temperature: feltAt(w, content, i),
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

/** Tile (x, y) on level `z` for the inspector, its last change shown by `lineOf`; undefined off
 * the map or on an unreached level. */
export function tileView(
  w: WorldState,
  x: number,
  y: number,
  z: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): TileView | undefined {
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
  const dark = 'known' in layer && !layer.known[i];
  const stained = z === 0 && map.stains[i]! > 0 ? content.features[map.stains[i]! - 1] : undefined;
  const rows = {
    x,
    y,
    z,
    ground: `${content.terrain.kinds[layer.tiles[i]!]!.name}${snowy ? ', snow-capped' : ''}${stained?.vein?.stainWord ? ` with a ${stained.vein.stainWord} stain` : ''}`,
    ...(stained && { stain: `${metalOf(stained)} lies below, on level ${stained.vein!.level}` }),
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
    ...(feature && { feature: featureWords(feature) }),
    ...waysOf(map, i, z),
    chunkX,
    chunkY,
    version: layer.chunkVersions[chunkY * chunksAcross(map) + chunkX]!,
    ...(changedBy && { changedBy: lineOf(changedBy) }),
    ...tileGoods(w, x, y, z, lineOf),
    ...(z === 0 && tileHouse(w, x, y, lineOf)),
    ...(z === 0 && tileField(w, x, y, lineOf)),
    ...(z === 0 && tileShaft(w, x, y, lineOf)),
    ...(z === 0 && tileWild(w, i)),
    ...(z === 0 && tilePlace(w, x, y, lineOf)),
  };
  // Unknown ground below is named only as unknown, with a vein glinting through (V-030).
  if (!dark) return rows;
  const { below, water, drinkable, crossing, aura, ways, feature: seen, ...safe } = rows;
  return {
    ...safe,
    ground: 'unknown: nobody has dug next to it',
    ...(feature?.vein && { feature: `${metalOf(feature)} glints through the dark` }),
  };
}

/** A vein's metal: its ore's name without "ore" ("iron"). */
const metalOf = (f: { yields: string }): string => itemName(f.yields).replace(/ ore$/, '');

/** What grows or lies on a tile for the page: a vein says how much ore is in this tile. */
function featureWords(f: (typeof content.features)[number]): string {
  if (!f.vein) return `${f.name} (${f.amount} ${itemName(f.yields)})`;
  const item = itemName(f.yields);
  return `${metalOf(f)}, ${f.amount} ${item.endsWith(' ore') ? 'ore' : item} in this tile`;
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

/** A spot in words from the camp, for the alert feed: "at the camp" within `NEAR` tiles of where
 * the band arrived, else "12 tiles north-east of the camp", with the level when below ground. */
export function placeWords(map: MapState, x: number, y: number, z: number): string {
  const [dx, dy] = [x - map.startX, y - map.startY];
  const far = Math.max(Math.abs(dx), Math.abs(dy));
  const below = z > 0 ? `, ${z} ${z === 1 ? 'level' : 'levels'} down` : '';
  if (far <= NEAR) return `at the camp${below}`;
  const ns = Math.abs(dy) * 2 >= Math.abs(dx) ? (dy < 0 ? 'north' : 'south') : '';
  const ew = Math.abs(dx) * 2 >= Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : '';
  return `${far} tiles ${[ns, ew].filter(Boolean).join('-')} of the camp${below}`;
}
const NEAR = 6;
