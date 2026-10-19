// Siting (P3.7, V-049, V-050): colonists choose where a house goes and how big it is; the player
// only says the colony needs one. Every footprint near the green is scored when asked, never
// drawn from a stream: metres of rise across it, plus tiles from the green, plus trees to fell.
// The lowest wins and ties go in tile order, so the same seed gives the same town.
import type { EngineContent, EntityRow, PartDef, SizeDef, WorldState } from '../core/index.ts';
import { haveOf, itemsOf, storeOf } from '../goods/index.ts';
import { reachFrom, type Spot } from '../paths/index.ts';
import { DUG_LEVEL, digsFor } from './dug.ts';
import { inRect, isTreeAt, wayFrom, wayTo, type Rect, type Site, type Way } from './way.ts';

export { inRect, type Rect, type Site } from './way.ts';
import { furnitureOf } from './furniture.ts';
import { partOf, plansOf } from './plans.ts';
import { ringOf } from './ring.ts';

/** Whether (x, y) is on the rectangle's edge, where its walls and door stand. */
export const onEdge = (r: Rect, x: number, y: number): boolean =>
  inRect(r, x, y) && (x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1);

const tilesOf = (r: Rect): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = r.y; y < r.y + r.h; y += 1)
    for (let x = r.x; x < r.x + r.w; x += 1) out.push([x, y]);
  return out;
};

/** Houses (and added rooms) standing or planned, and sites sent back, as footprints. */
export const housesOf = (world: WorldState): EntityRow[] => world.entities['house'] ?? [];
export const rectOf = (h: EntityRow): Rect => ({
  x: h['x'] as number,
  y: h['y'] as number,
  w: h['w'] as number,
  h: h['h'] as number,
});

/** One round of siting's view of the surface, worked out once: the tiles with something lying
 * on them, and those with a part built, a store tile or a plan on them. */
export interface Ground {
  items: ReadonlySet<number>;
  taken: ReadonlySet<number>;
}

export function groundOf(world: WorldState): Ground {
  const width = world.map.width;
  const at = (r: EntityRow) => (r['y'] as number) * width + (r['x'] as number);
  const taken = new Set([
    ...storeOf(world)
      .filter((s) => s['z'] === 0)
      .map(at),
    ...plansOf(world).map(at),
    // Fields planned or standing (P4.7), whose tiles the field table lists.
    ...(world.entities['field'] ?? [])
      .filter((f) => f['state'] !== 'sent')
      .flatMap((f) => f['tiles'] as number[]),
    // A piece standing outside every house, the campfire (P3.6); those in a room are its own.
    ...furnitureOf(world)
      .filter(
        (f) =>
          f['z'] === 0 &&
          !housesOf(world).some((h) => inRect(rectOf(h), f['x'] as number, f['y'] as number)),
      )
      .map(at),
  ]);
  world.map.built.forEach((b, i) => b && taken.add(i));
  return {
    items: new Set(
      itemsOf(world)
        .filter((i) => i['z'] === 0 && !i['holder'])
        .map(at),
    ),
    taken,
  };
}

/** What a footprint tile holds for building: `no`, a tree to fell first, or open ground (a bush
 * or herbs there is cleared when the part is built). */
function tileFit(
  world: WorldState,
  content: EngineContent,
  ground: Ground,
  x: number,
  y: number,
): 'no' | 'tree' | 'ok' {
  const map = world.map;
  if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return 'no';
  const i = y * map.width + x;
  const kind = content.terrain.kinds[map.tiles[i]!]!;
  if (!kind.buildable || kind.water || kind.solid || map.built[i]) return 'no';
  if (ground.items.has(i)) return 'no';
  const f = map.features[i]! ? content.features[map.features[i]! - 1]! : undefined;
  if (f && (f.kind === 'tree' || f.kind === 'log')) return 'tree';
  if (f && f.kind !== 'bush' && f.kind !== 'herb') return 'no';
  return 'ok';
}

/** Whether anything built, planned, stored or sent back is on or beside the footprint (a tile
 * is kept clear round a building), other than the house rows in `own`. */
function crowded(world: WorldState, ground: Ground, r: Rect, mine: readonly EntityRow[]): boolean {
  const ring = { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 };
  const width = world.map.width;
  for (const [x, y] of tilesOf(ring))
    if (ground.taken.has(y * width + x) && !mine.some((h) => inRect(rectOf(h), x, y))) return true;
  return housesOf(world).some((h) => {
    if (mine.includes(h)) return false;
    const o = rectOf(h);
    const pad = h['state'] === 'sent' ? r : ring;
    return o.x < pad.x + pad.w && pad.x < o.x + o.w && o.y < pad.y + pad.h && pad.y < o.y + o.h;
  });
}

/** Scores the footprint's new tiles (those outside the house rows in `own`): undefined when one
 * cannot be built on, else its rise in metres over all of `r` and its trees to fell. */
export function scoreRect(
  world: WorldState,
  content: EngineContent,
  r: Rect,
  own: ReadonlySet<number> = new Set(),
  ground: Ground = groundOf(world),
): { rise: number; trees: number[] } | undefined {
  const mine = housesOf(world).filter((h) => own.has(h.id));
  if (crowded(world, ground, r, mine)) return undefined;
  const map = world.map;
  let low = Infinity;
  let high = -Infinity;
  const trees: number[] = [];
  for (const [x, y] of tilesOf(r)) {
    const i = y * map.width + x;
    if (!mine.some((h) => inRect(rectOf(h), x, y))) {
      const fit = tileFit(world, content, ground, x, y);
      if (fit === 'no') return undefined;
      if (fit === 'tree') trees.push(i);
    }
    const e = map.elevation[i]!;
    if (e < low) low = e;
    if (e > high) high = e;
  }
  return { rise: high - low, trees };
}

const far = (g: Spot, r: Rect): number =>
  Math.max(
    Math.max(r.x - g.x, g.x - (r.x + r.w - 1), 0),
    Math.max(r.y - g.y, g.y - (r.y + r.h - 1), 0),
  );

/** The door tile: on the side that faces the green, the inner tile of that side nearest it. */
export function doorOf(r: Rect, g: Spot): Spot {
  const [cx2, cy2] = [2 * r.x + r.w - 1, 2 * r.y + r.h - 1];
  const [dx, dy] = [2 * g.x - cx2, 2 * g.y - cy2];
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  if (Math.abs(dx) * r.h >= Math.abs(dy) * r.w)
    return { x: dx < 0 ? r.x : r.x + r.w - 1, y: clamp(g.y, r.y + 1, r.y + r.h - 2), z: 0 };
  return { x: clamp(g.x, r.x + 1, r.x + r.w - 2), y: dy < 0 ? r.y : r.y + r.h - 1, z: 0 };
}

/** The tile just outside a door, the way in. */
export function outsideOf(r: Rect, d: Spot): Spot {
  if (d.x === r.x) return { x: d.x - 1, y: d.y, z: 0 };
  if (d.x === r.x + r.w - 1) return { x: d.x + 1, y: d.y, z: 0 };
  if (d.y === r.y) return { x: d.x, y: d.y - 1, z: 0 };
  return { x: d.x, y: d.y + 1, z: 0 };
}

/** The best site for a w by h house within `near` tiles of the green that can be reached from
 * it, felling trees on the way if need be (they count with the site's own), or undefined when
 * no ground there fits. */
export function siteFor(
  world: WorldState,
  content: EngineContent,
  green: Spot,
  size: { w: number; h: number },
  way: Way = wayFrom(world, content, green),
  ground: Ground = groundOf(world),
): Site | undefined {
  const near = Math.max(content.buildings.house.near, ringOf(world, content));
  const width = world.map.width;
  const found: { site: Site; score: number }[] = [];
  for (let y = green.y - near - size.h + 1; y <= green.y + near; y += 1)
    for (let x = green.x - near - size.w + 1; x <= green.x + near; x += 1) {
      const r = { x, y, w: size.w, h: size.h };
      const d = far(green, r);
      // Not on the green itself, nor right beside it: the green stays open.
      if (d < 2 || d > near) continue;
      const door = doorOf(r, green);
      const out = outsideOf(r, door);
      const path = way.trees[out.y * width + out.x]!;
      if (path < 0) continue;
      const s = scoreRect(world, content, r, undefined, ground);
      if (!s) continue;
      found.push({ site: { ...r, ...s, far: d, door }, score: s.rise + d + s.trees.length + path });
    }
  // Lowest score first, ties in tile order; the way in must not cross the site itself.
  found.sort((a, b) => a.score - b.score || a.site.y - b.site.y || a.site.x - b.site.x);
  for (const { site } of found) {
    const out = outsideOf(site, site.door);
    const tiles = wayTo(way, out.y * width + out.x);
    if (tiles.some((i) => inRect(site, i % width, Math.floor(i / width)))) continue;
    const extra = tiles.filter((i) => isTreeAt(world, content, i) && !site.trees.includes(i));
    return { ...site, trees: [...site.trees, ...extra] };
  }
  return undefined;
}

/** A house's parts by tile: walls round the edge, the door, a floor inside. */
export function partsOf(
  content: EngineContent,
  r: Rect,
  door: Spot,
  wall: PartDef,
  skip: (x: number, y: number) => boolean = () => false,
) {
  const house = content.buildings.house;
  const out: { x: number; y: number; part: PartDef }[] = [];
  for (const [x, y] of tilesOf(r)) {
    if (skip(x, y)) continue;
    const part =
      x === door.x && y === door.y
        ? partOf(content, house.door)!
        : onEdge(r, x, y)
          ? wall
          : partOf(content, house.floor)!;
    out.push({ x, y, part });
  }
  return out;
}

/** The material each part list needs, by good. */
export function costOf(parts: readonly { part: PartDef }[]): Map<string, number> {
  const need = new Map<string, number>();
  for (const { part } of parts) {
    need.set(part.material, (need.get(part.material) ?? 0) + part.cost);
    if (part.also)
      need.set(part.also.material, (need.get(part.also.material) ?? 0) + part.also.cost);
  }
  return need;
}

/** How much of a good the colony has and could get: all of it wherever it lies, plus, when
 * `ground` is set, what the trees, logs and boulders within `house.reach` tiles of the store
 * would give, and the known tiles on level 1 that dig it and a miner could get beside (Morgan,
 * 2026-10-18: house size counts what is within reach). */
export function withinReach(
  world: WorldState,
  content: EngineContent,
  good: string,
  ground: boolean,
): number {
  let total = haveOf(world, content, good);
  if (!ground) return total;
  const map = world.map;
  const first = storeOf(world)[0];
  const [ox, oy] = first ? [first['x'] as number, first['y'] as number] : [map.startX, map.startY];
  const reach = content.buildings.house.reach;
  for (let y = Math.max(0, oy - reach); y <= Math.min(map.height - 1, oy + reach); y += 1)
    for (let x = Math.max(0, ox - reach); x <= Math.min(map.width - 1, ox + reach); x += 1) {
      const f = map.features[y * map.width + x]!;
      const def = f ? content.features[f - 1]! : undefined;
      if (def && def.yields === good && ['tree', 'log', 'boulder'].includes(def.kind))
        total += def.amount;
    }
  // Ground dug for it (V-097, clay): the tiles a miner could dig (`digsFor`) from the store.
  const under = map.levels[DUG_LEVEL - 1];
  if (!under) return total;
  const reached = reachFrom(content, map, { x: ox, y: oy, z: 0 });
  for (let y = Math.max(0, oy - reach); y <= Math.min(map.height - 1, oy + reach); y += 1)
    for (let x = Math.max(0, ox - reach); x <= Math.min(map.width - 1, ox + reach); x += 1) {
      const i = y * map.width + x;
      if (digsFor(world, content, reached, i, good))
        total += content.terrain.kinds[under.tiles[i]!]!.digs!.count;
    }
  return total;
}

/** Whether the colony has, or (with `ground`) could get, all the material a part list needs. */
function affords(
  world: WorldState,
  content: EngineContent,
  parts: readonly { part: PartDef }[],
  ground: boolean,
) {
  return [...costOf(parts)].every(([good, n]) => withinReach(world, content, good, ground) >= n);
}

/** The house to build for `sleepers` people, and where. The size is the largest the colony has
 * or could get the material for in some wall material that sleeps no more than them (start
 * small and grow: a house adds rooms as its sleepers outgrow it, grow.ts), else the smallest
 * that can be finished. The walls are of the MOST PLENTIFUL material (stock plus what lies
 * within `reach`) among those that can finish a house of that size; ties keep content order
 * (Morgan, 2026-10-19, amending V-096). With material for none, the smallest with ground for it
 * and the most plentiful wall material, ties to the last in content order (its plans wait for
 * material). `why` says which. Undefined when no ground near the green fits any size. */
export function chooseHouse(
  world: WorldState,
  content: EngineContent,
  green: Spot,
  sleepers: number,
): { size: SizeDef; site: Site; wall: PartDef; why: string } | undefined {
  const way = wayFrom(world, content, green);
  const ground = groundOf(world);
  const sited = content.buildings.house.sizes.flatMap((size) => {
    const site = siteFor(world, content, green, size, way, ground);
    return site ? [{ size, site }] : [];
  });
  if (!sited.length) return undefined;
  const walls = content.buildings.house.walls.map((id) => partOf(content, id)!);
  const word = (w: PartDef) => w.name.replace(/ wall$/, '');
  const fits = (o: (typeof sited)[number], w: PartDef) =>
    affords(world, content, partsOf(content, o.site, o.site.door, w), true);
  const able = sited.filter((o) => walls.some((w) => fits(o, w)));
  const pick = able.findLast((o) => o.size.sleeps <= sleepers) ?? able[0];
  if (!pick) {
    // The most plentiful material, ties to the last in content order (not clay, which only miners
    // will dig, while wood stands about).
    const have = (w: PartDef) => withinReach(world, content, w.material, true);
    const wall = walls.reduce((best, w) => (have(w) >= have(best) ? w : best));
    return {
      ...sited[0]!,
      wall,
      why: `${word(wall)} walls, with too little material yet for all of it`,
    };
  }
  let wall = walls[0]!;
  let most = -1;
  for (const w of walls) {
    if (!fits(pick, w)) continue;
    const have = withinReach(world, content, w.material, true);
    if (have > most) [wall, most] = [w, have];
  }
  const good = content.work.stock.find((s) => s.good === wall.material)?.name ?? wall.material;
  return {
    ...pick,
    wall,
    why: `${word(wall)} walls, as ${good} is most plentiful and enough to finish it`,
  };
}
