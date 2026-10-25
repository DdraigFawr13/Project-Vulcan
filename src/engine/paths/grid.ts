// What a walker can stand on and what each step costs (P2.3), read from the map as it is now:
// stone, solid ground, deep water and blocking features are never crossed; frozen lake water is.
// Costs are whole numbers in tenths of a straight step on plain ground (terrain.json `walking`).
import type { EngineContent, MapState } from '../core/index.ts';
import { layerOf } from '../map/index.ts';
import { isFrozen } from '../weather/index.ts';

/** A tile on a level, packed as `z * width * height + y * width + x`. */
export type Node = number;

export interface Spot {
  x: number;
  y: number;
  z: number;
}

/** Per terrain kind: its walking multiplier (0 never walked) and whether it leads down or up. */
interface Kinds {
  walk: Uint8Array;
  down: Uint8Array;
  up: Uint8Array;
  shaft: number;
  water: Uint8Array;
}

const kindsCache = new WeakMap<EngineContent, Kinds>();

function kindsOf(content: EngineContent): Kinds {
  const cached = kindsCache.get(content);
  if (cached) return cached;
  const list = content.terrain.kinds;
  const dials = content.terrain.generator.underground;
  const id = (k: string): number => list.findIndex((d) => d.id === k);
  const walk = new Uint8Array(list.length);
  const water = new Uint8Array(list.length);
  list.forEach((k, i) => {
    walk[i] = k.stone || k.solid || k.water === 'deep' ? 0 : (k.walk ?? 1);
    water[i] = k.water ? 1 : 0;
  });
  const down = new Uint8Array(list.length);
  const up = new Uint8Array(list.length);
  for (const k of [dials.stairsDown, dials.stairs, dials.shaft]) down[id(k)] = 1;
  for (const k of [dials.stairsUp, dials.stairs, dials.shaft]) up[id(k)] = 1;
  const kinds = { walk, down, up, shaft: id(dials.shaft), water };
  kindsCache.set(content, kinds);
  return kinds;
}

export const pack = (map: MapState, s: Spot): Node =>
  s.z * map.width * map.height + s.y * map.width + s.x;

export function unpack(map: MapState, node: Node): Spot {
  const n = map.width * map.height;
  const i = node % n;
  return { x: i % map.width, y: Math.floor(i / map.width), z: Math.floor(node / n) };
}

/** The multiplier for standing on tile `i` of level `z` now: 0 when it cannot be walked. */
export function walkAt(content: EngineContent, map: MapState, z: number, i: number): number {
  const layer = layerOf(map, z);
  if (!layer) return 0;
  const kinds = kindsOf(content);
  const kind = layer.tiles[i]!;
  if (z === 0 && kinds.water[kind] && isFrozen(map, i)) return content.terrain.walking.ice;
  const walk = kinds.walk[kind]!;
  if (!walk) return 0;
  const feature = layer.features[i]!;
  if (z === 0 && feature && content.features[feature - 1]?.blocks) return 0;
  // A built wall blocks the way (P3.1); a door and a floor do not.
  const built = z === 0 ? (map.built[i] ?? 0) : 0;
  if (built && content.buildings.parts[built - 1]?.kind === 'wall') return 0;
  return walk;
}

/** What standing on tile `i` of level `z` costs now, in tenths of a step on plain ground: its
 * walking multiplier times 10, or `walking.road` on a road (P5.10, V-054); 0 when it cannot be
 * stood on. Searches and steps cost by this; `walkAt` stays the plain multiplier. */
export function costAt(content: EngineContent, map: MapState, z: number, i: number): number {
  const walk = walkAt(content, map, z, i);
  if (!walk) return 0;
  const built = z === 0 ? (map.built[i] ?? 0) : 0;
  if (built && content.buildings.parts[built - 1]?.kind === 'road')
    return content.terrain.walking.road;
  return walk * 10;
}

/** The cost of climbing from `i` on level `z` to the same place on `z + 1`: 0 when there is no
 * way down there (stairs or a shaft above meeting stairs or a shaft below). */
export function downAt(content: EngineContent, map: MapState, z: number, i: number): number {
  const top = layerOf(map, z);
  const below = layerOf(map, z + 1);
  if (!top || !below) return 0;
  const kinds = kindsOf(content);
  const a = top.tiles[i]!;
  const b = below.tiles[i]!;
  if (!kinds.down[a] || !kinds.up[b]) return 0;
  const walking = content.terrain.walking;
  return a === kinds.shaft && b === kinds.shaft ? walking.shaft : walking.stairs;
}

/** The cost of one step between neighbouring nodes (a side, a corner or a level), or 0 when it
 * cannot be taken now. A corner is cut only when both sides beside it are open. */
export function stepCost(content: EngineContent, map: MapState, from: Node, to: Node): number {
  const a = unpack(map, from);
  const b = unpack(map, to);
  const w = map.width;
  if (a.x === b.x && a.y === b.y) {
    if (b.z === a.z + 1) return downAt(content, map, a.z, a.y * w + a.x);
    if (b.z === a.z - 1) return downAt(content, map, b.z, a.y * w + a.x);
    return 0;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (a.z !== b.z || Math.abs(dx) > 1 || Math.abs(dy) > 1) return 0;
  const cost = costAt(content, map, b.z, b.y * w + b.x);
  if (!cost || !walkAt(content, map, a.z, a.y * w + a.x)) return 0;
  const walking = content.terrain.walking;
  if (dx && dy) {
    if (!walkAt(content, map, a.z, a.y * w + b.x) || !walkAt(content, map, a.z, b.y * w + a.x))
      return 0;
    return Math.floor((walking.diagonal * cost) / 10);
  }
  return Math.floor((walking.straight * cost) / 10);
}
