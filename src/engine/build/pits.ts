// The tan pits (Phase 5B Bundle 5, P5.5, V-134): nobody places them. Once two hides lie in the
// store and leather is short (the Clothes plate is short of outer spares and fewer than two
// leather or cured hides lie in store), and no pits stand or are planned, the colony plans them
// at the edge of the village, downstream of the green, near water. Builders make them like the
// smelter (people/station.ts, a `station` row of kind `pits`); the tanner works them
// (people/tan.ts). Nothing is drawn from a stream: ties go in tile order.
//
// "Edge": outside the town ring (Chebyshev from the green) and within the smelter's `reach` of
// it; the nearest to the ring wins, then the nearer water. "Downstream": the map's river leaves by
// the edge `riverExit`; a site is downstream when it lies further toward that edge than the
// green does; an upstream block is taken only when no downstream one will do. A map with no such
// exit has no flow: any side is allowed.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import {
  inStore,
  isTree,
  itemsOf,
  layItem,
  marksOf,
  raiseStock,
  shortOf,
  stockOf,
} from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { PITS_KIND, wantOf } from './houses.ts';
import { cheb, freeBlock } from './metalsite.ts';
import { ringOf } from './ring.ts';
import { stationsOf } from './station.ts';

/** The tan pits row not sent back, if any. */
export const livePits = (world: WorldState): EntityRow | undefined =>
  stationsOf(world).find((s) => s['kind'] === PITS_KIND && s['state'] !== 'sent');

/** How many of these item kinds lie in a store, free of any hand. */
export const storedOf = (world: WorldState, kinds: readonly string[]): number =>
  itemsOf(world)
    .filter(
      (i) =>
        kinds.includes(i['kind'] as string) &&
        !i['holder'] &&
        inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
    )
    .reduce((n, i) => n + (i['count'] as number), 0);

/** Leather and cured hides in the store. */
export const leatherStored = (world: WorldState, content: EngineContent): number =>
  storedOf(world, [content.clothes.tan.leather.makes, content.clothes.tan.fur.makes]);

/** Whether the tailor wants an outer layer (the plate is short of outer spares). */
export const wantsOuter = (world: WorldState, content: EngineContent): boolean =>
  shortOf(world, content, content.clothes.slots[1]!.id) > 0;

/** Progress toward the edge the river leaves by, or undefined when the map has no flow. */
function flowOf(world: WorldState): ((x: number, y: number) => number) | undefined {
  const { width, height } = world.map;
  const exits: Record<string, (x: number, y: number) => number> = {
    north: (_x, y) => height - y,
    south: (_x, y) => y,
    east: (x) => x,
    west: (x) => width - x,
  };
  return exits[world.map.riverExit];
}

/** Features the pits' ground may have: trees are felled first (marked, like a pasture's), bushes
 * and herbs go when the pits are dug. */
const CLEARABLE = ['tree', 'bush', 'herb'];

/** What an upstream site adds to a block's score: more than any downstream one scores. */
const UPSTREAM = 100_000;

/** Tiles to the nearest water from a tile, within `near`; `near + 1` when none. */
function waterDist(
  world: WorldState,
  content: EngineContent,
  cx: number,
  cy: number,
  near: number,
) {
  const map = world.map;
  for (let r = 1; r <= near; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const [x, y] = [cx + dx, cy + dy];
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (content.terrain.kinds[map.tiles[y * map.width + x]!]!.water) return r;
      }
  return near + 1;
}

/** The best free block for the pits, or undefined: at the edge, downstream, within `water` tiles
 * of water, on free ground (never a site sent back), reachable from the green. */
function siteOf(world: WorldState, content: EngineContent, green: Spot) {
  const def = content.clothes.pits;
  const ring = ringOf(world, content);
  const reach = ring + content.metal.smelter.reach;
  const flow = flowOf(world);
  const sent = stationsOf(world).filter((s) => s['kind'] === PITS_KIND && s['state'] === 'sent');
  const inSent = (x: number, y: number) =>
    sent.some(
      (s) =>
        x >= (s['x'] as number) &&
        x < (s['x'] as number) + (s['w'] as number) &&
        y >= (s['y'] as number) &&
        y < (s['y'] as number) + (s['h'] as number),
    );
  const map = world.map;
  const found: { at: Spot; score: number; trees: number[] }[] = [];
  for (let y = Math.max(1, green.y - reach); y <= Math.min(map.height - 2, green.y + reach); y += 1)
    for (
      let x = Math.max(1, green.x - reach);
      x <= Math.min(map.width - 2, green.x + reach);
      x += 1
    ) {
      const out = cheb(green, x, y);
      if (out <= ring || out > reach) continue;
      const [mx, my] = [x + (def.w >> 1), y + (def.h >> 1)];
      // Downstream first; upstream only when no downstream block will do (a green near the
      // edge the river leaves by, as on anvil, leaves too little ground below it).
      const up = flow && flow(mx, my) <= flow(green.x, green.y) ? UPSTREAM : 0;
      const water = waterDist(world, content, mx, my, def.water);
      if (water > def.water) continue;
      let clear = true;
      const trees: number[] = [];
      for (let dy = 0; dy < def.h && clear; dy += 1)
        for (let dx = 0; dx < def.w && clear; dx += 1) {
          clear =
            freeBlock(world, content, x + dx, y + dy, 1, CLEARABLE) && !inSent(x + dx, y + dy);
          const i = (y + dy) * map.width + x + dx;
          if (clear && isTree(world, content, i)) trees.push(i);
        }
      // Each tree to fell counts as much as a step further out.
      const score = up + (out - ring + trees.length) * 100 + water;
      if (clear) found.push({ at: { x, y, z: 0 }, score, trees });
    }
  found.sort((a, b) => a.score - b.score || a.at.y - b.at.y || a.at.x - b.at.x);
  // Reached at a tile of the block no tree stands on.
  const open = (f: (typeof found)[number]): Spot | undefined => {
    for (let dy = 0; dy < def.h; dy += 1)
      for (let dx = 0; dx < def.w; dx += 1) {
        const [x, y] = [f.at.x + dx, f.at.y + dy];
        if (!f.trees.includes(y * map.width + x)) return { x, y, z: 0 };
      }
    return undefined;
  };
  return found.find((f) => {
    const at = open(f);
    return !!at && canReach(content, map, green, at);
  });
}

/** Hourly: plans the tan pits when hides wait and leather is short. `sent` marks a plan replacing
 * one sent back (it is sited at once and cannot be sent back). */
export function planPits(ctx: SystemContext, green: Spot, sent = 0): void {
  const { world, content, state } = ctx;
  const def = content.clothes.pits;
  const hide = content.clothes.tan.hide;
  const hides = storedOf(world, [hide]);
  if (livePits(world) || hides < 2) return;
  if (!wantsOuter(world, content) || leatherStored(world, content) >= 2) return;
  if (state['pitsNoGround'] && !sent && world.tick < (state['pitsTried'] ?? 0) + TICKS_PER_DAY)
    return;
  state['pitsTried'] = world.tick;
  const first = itemsOf(world).find((i) => i['kind'] === hide && !i['holder']);
  const plate = stockOf(world, content.clothes.good);
  const want = wantOf(world, content, PITS_KIND);
  const causes = [
    (first?.['made'] as number) ?? 0,
    (plate?.['line'] as number) ?? 0,
    want.line ?? 0,
  ].filter((l) => l > 0);
  const site = siteOf(world, content, green);
  if (!site) {
    state['pitsNoGround'] ||= ctx.emit('pits.noGround', { causes, data: { count: hides } });
    return;
  }
  state['pitsNoGround'] = 0;
  const line = ctx.emit('pits.planned', { causes, data: { count: hides } });
  const id = addEntity(world, 'station', {
    ...{ kind: PITS_KIND, x: site.at.x, y: site.at.y, z: 0, w: def.w, h: def.h, state: 'plan' },
    ...{ line, have: 0, work: -1, made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '', sent },
  });
  // Trees on the ground are felled first, as on a pasture's site.
  const width = world.map.width;
  for (const i of site.trees)
    addEntity(world, 'mark', { x: i % width, y: Math.floor(i / width), line, house: id });
  raiseStock(ctx, def.material, def.name, line);
}

/** The `sendBack {pits}` lever: pits still planned, nothing built, not themselves a replacement,
 * are dropped; material brought is laid back, the site is never chosen again and the colony
 * sites again at once. */
export function sendBackPits(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
  green: Spot,
): void {
  const { world, content } = ctx;
  const s = stationsOf(world).find((r) => r.id === data['pits'] && r['kind'] === PITS_KIND);
  const why =
    !s || s['state'] !== 'plan'
      ? 'no such plan'
      : s['sent']
        ? 'it was sent back once already'
        : (s['work'] as number) >= 0
          ? 'building has begun'
          : undefined;
  if (why || !s) {
    ctx.emit('command.refused', {
      causes: [cause],
      data: { kind: 'sendBack', reason: why ?? 'no such plan' },
    });
    return;
  }
  const line = ctx.emit('pits.sentBack', { causes: [cause, s['line'] as number] });
  if ((s['have'] as number) > 0)
    layItem(world, {
      kind: content.clothes.pits.material,
      count: s['have'] as number,
      ...{ x: s['x'] as number, y: s['y'] as number, z: 0, made: line },
    });
  s['state'] = 'sent';
  for (const m of marksOf(world).filter((m) => m['house'] === s.id))
    removeEntity(world, 'mark', m.id);
  planPits(ctx, green, 1);
}
