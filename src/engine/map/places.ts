// The finds (6W Slice 5 part 2, V-206): springs, old woods, clay banks, fishing pools, lookouts,
// cave mouths and bear dens, laid when the valley is made from the `places` stream (so no other
// stream shifts) at least `from` tiles from the green, `gap` apart, at most `most` of each. A clay
// bank turns `size` open river-bank tiles to clay. Finding one is land's (`land/places.ts`); what
// a found one opens is read here: fellers' and anglers' areas, a bank's clay, a lookout's view.
import { WATER, streamFor, type EngineContent, type MapState, type Place } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import type { Area } from './known.ts';

type Kind = EngineContent['work']['scout']['places']['kinds'][number];

const cheb = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** The kind of find `kind` names. */
export const placeKind = (content: EngineContent, kind: string): Kind | undefined =>
  content.work.scout.places.kinds.find((k) => k.id === kind);

/** Lays every kind of find, kind by kind in content order. */
export function layPlaces(ctx: SystemContext, map: MapState): Place[] {
  const { content } = ctx;
  const rng = streamFor(ctx.world, 'places');
  const places: Place[] = [];
  for (const kind of content.work.scout.places.kinds) {
    const cand = candidates(content, map, kind);
    // Shuffled first, so equal scores fall by the seed, then the best first.
    for (let k = cand.length - 1; k > 0; k -= 1) {
      const j = rng.int(k + 1);
      [cand[k], cand[j]] = [cand[j]!, cand[k]!];
    }
    cand.sort((a, b) => b[1] - a[1]);
    const mine: number[] = [];
    for (const [i] of cand) {
      if (mine.length >= kind.most) break;
      const [x, y] = [i % map.width, Math.floor(i / map.width)];
      const spaced = mine.every(
        (o) => cheb(x, y, o % map.width, Math.floor(o / map.width)) >= kind.gap,
      );
      if (!spaced || places.some((p) => cheb(x, y, p.x, p.y) < 6)) continue;
      if (kind.rule === 'bank' && !layBank(content, map, x, y, kind.size)) continue;
      mine.push(i);
      places.push({ kind: kind.id, x, y, by: 0, line: 0, tick: 0 });
    }
  }
  return places;
}

/** The tiles `kind`'s rule allows, each with its score (higher is better). */
function candidates(content: EngineContent, map: MapState, kind: Kind): [number, number][] {
  const out: [number, number][] = [];
  const w = map.width;
  const from = content.work.scout.places.from;
  const green = map.elevation[map.startY * w + map.startX]!;
  for (let y = 4; y < map.height - 4; y += 1)
    for (let x = 4; x < w - 4; x += 1) {
      if (cheb(x, y, map.startX, map.startY) < from) continue;
      const i = y * w + x;
      const score = RULES[kind.rule]({ content, map, kind, i, x, y, green });
      if (score !== undefined) out.push([i, score]);
    }
  return out;
}

/** Whether tile `i` is open ground: not rock, not solid, not water. */
const open = (content: EngineContent, map: MapState, i: number): boolean => {
  const k = content.terrain.kinds[map.tiles[i]!]!;
  return !map.water[i] && !k.solid && !k.stone;
};

/** Where a rule looks: the tile, its place, the green's height and the kind. */
interface At {
  content: EngineContent;
  map: MapState;
  kind: Kind;
  i: number;
  x: number;
  y: number;
  green: number;
}

/** Each rule's score for a tile (higher is better), or undefined where it does not allow it. */
const RULES: Record<Kind['rule'], (a: At) => number | undefined> = {
  spring: ({ map, i }) => (WATER[map.water[i]!] === 'spring' ? 0 : undefined),
  pool: ({ map, i, x, y }) => {
    if (WATER[map.water[i]!] !== 'lake' || x % 3 || y % 3) return undefined;
    const w = map.width;
    return [3, -3, 3 * w, -3 * w].some((d) => !map.water[i + d]) ? 0 : undefined;
  },
  grove: ({ content, map, kind, i, x, y }) => {
    if ((x + y) % 2 || !isTree(content, map, i)) return undefined;
    const n = treesAbout(content, map, x, y);
    return n >= kind.size ? n : undefined;
  },
  lookout: ({ content, map, kind, i, x, y, green }) =>
    even(x, y) &&
    open(content, map, i) &&
    highest(map, x, y) &&
    map.elevation[i]! - green >= kind.size
      ? map.elevation[i]!
      : undefined,
  cliff: ({ content, map, kind, i, x, y }) =>
    even(x, y) && open(content, map, i) && cliffBeside(content, map, i, kind.size) ? 0 : undefined,
  bank: ({ content, map, i, x, y }) => (even(x, y) && bankTile(content, map, i) ? 0 : undefined),
};

/** Every other tile each way: rules that look round a tile need not look at its neighbours. */
const even = (x: number, y: number): boolean => x % 2 === 0 && y % 2 === 0;

const isTree = (content: EngineContent, map: MapState, i: number): boolean => {
  const f = map.features[i]!;
  return !!f && content.features[f - 1]!.kind === 'tree';
};

/** Trees within 4 tiles of (x, y). */
function treesAbout(content: EngineContent, map: MapState, x: number, y: number): number {
  let n = 0;
  for (let dy = -4; dy <= 4; dy += 1)
    for (let dx = -4; dx <= 4; dx += 1)
      if (isTree(content, map, (y + dy) * map.width + x + dx)) n += 1;
  return n;
}

/** Whether nothing within 4 tiles of (x, y) stands higher (the map's edge counts as lower). */
function highest(map: MapState, x: number, y: number): boolean {
  const e = map.elevation[y * map.width + x]!;
  for (let dy = -4; dy <= 4; dy += 2)
    for (let dx = -4; dx <= 4; dx += 2)
      if (map.elevation[(y + dy) * map.width + x + dx]! > e) return false;
  return true;
}

/** Whether a rock face at least `rise` metres higher stands beside tile `i`. */
function cliffBeside(content: EngineContent, map: MapState, i: number, rise: number): boolean {
  return [1, -1, map.width, -map.width].some((d) => {
    const k = content.terrain.kinds[map.tiles[i + d]!]!;
    return !!k.stone && map.elevation[i + d]! - map.elevation[i]! >= rise;
  });
}

/** Open, bare ground beside a river. */
function bankTile(content: EngineContent, map: MapState, i: number): boolean {
  if (!open(content, map, i) || map.features[i] || map.built[i]) return false;
  return [1, -1, map.width, -map.width].some((d) => WATER[map.water[i + d]!] === 'river');
}

/** Turns `size` bank tiles within 2 of (x, y) to clay; false (and nothing changed) if too few. */
function layBank(
  content: EngineContent,
  map: MapState,
  x: number,
  y: number,
  size: number,
): boolean {
  const clay = content.terrain.kinds.findIndex((k) => k.digs && !k.stone);
  const tiles: number[] = [];
  for (let dy = -2; dy <= 2; dy += 1)
    for (let dx = -2; dx <= 2; dx += 1) {
      const i = (y + dy) * map.width + x + dx;
      if (tiles.length < size && bankTile(content, map, i)) tiles.push(i);
    }
  if (clay < 0 || tiles.length < size) return false;
  for (const i of tiles) map.tiles[i] = clay;
  return true;
}

/** Areas of `r` round each found place whose kind opens `use`, in the order they were found. */
export function foundAreas(content: EngineContent, map: MapState, use: string, r: number): Area[] {
  return map.places
    .filter((p) => p.line && placeKind(content, p.kind)?.use === use)
    .sort((a, b) => a.tick - b.tick)
    .map((p) => [p.x, p.y, r] as const);
}

/** The surface tiles of found clay banks: clay, within 2 of the bank. */
export function bankTiles(content: EngineContent, map: MapState): number[] {
  const out: number[] = [];
  for (const [x, y] of foundAreas(content, map, 'clay', 2))
    for (let yy = y - 2; yy <= y + 2; yy += 1)
      for (let xx = x - 2; xx <= x + 2; xx += 1) {
        const i = yy * map.width + xx;
        if (content.terrain.kinds[map.tiles[i]!]!.digs && !out.includes(i)) out.push(i);
      }
  return out;
}

/** Whether (x, y) is on or beside a found lookout. */
export const atLookout = (content: EngineContent, map: MapState, x: number, y: number): boolean =>
  map.places.some(
    (p) => p.line && cheb(p.x, p.y, x, y) <= 1 && placeKind(content, p.kind)?.use === 'look',
  );
