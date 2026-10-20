// Granaries (P4.7 review): when a field is reaped the harvest beyond the store's Food plate has
// nowhere to go, so the band lays out a granary beside the field, on the side nearest the green
// and outside the town ring, `buildings.granary` tiles in size (goods/granary.ts keeps the
// tiles). One a field; a field that finds no room is tried again each hour while food lies
// outside the store with the store at its plate.
import type { EntityRow, WorldState } from '../core/index.ts';
import {
  addGranary,
  freeTile,
  granaryFor,
  inGranary,
  inStore,
  itemsOf,
  keepable,
  storedEnough,
} from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { cropOf, liveFields, tilesOf } from './fields.ts';
import { greenOf, ringOf } from './ring.ts';

/** The tiles for a granary beside field `f`: a block touching its edge, every tile free ground
 * outside the town ring and no field's, nearest the green (tile order breaks ties). */
export function siteGranary(
  ctx: SystemContext,
  f: EntityRow,
): { tiles: [number, number][]; w: number; h: number } | undefined {
  const { world, content } = ctx;
  const { width: gw, height: gh } = content.buildings.granary;
  const map = world.map;
  const green = greenOf(world);
  const ring = ringOf(world, content);
  const fields = new Set(liveFields(world).flatMap((r) => tilesOf(r)));
  const xs = tilesOf(f).map((i) => i % map.width);
  const ys = tilesOf(f).map((i) => Math.floor(i / map.width));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // North and south sides run along x (the granary lies `gw` wide), east and west along y.
  const blocks: { x: number; y: number; w: number; h: number }[] = [];
  for (const [w, h] of [[gw, gh]] as const) {
    for (let x = x0 - (w - 1); x <= x1; x += 1) blocks.push({ x, y: y0 - h, w, h });
    for (let x = x0 - (w - 1); x <= x1; x += 1) blocks.push({ x, y: y1 + 1, w, h });
  }
  for (const [w, h] of [[gh, gw]] as const) {
    for (let y = y0 - (h - 1); y <= y1; y += 1) blocks.push({ x: x0 - w, y, w, h });
    for (let y = y0 - (h - 1); y <= y1; y += 1) blocks.push({ x: x1 + 1, y, w, h });
  }
  let best: { x: number; y: number; w: number; h: number } | undefined;
  let far = Infinity;
  for (const b of blocks) {
    // Squared distance from the block's centre (doubled, to stay in integers) to the green.
    const dx = 2 * b.x + b.w - 1 - 2 * green.x;
    const dy = 2 * b.y + b.h - 1 - 2 * green.y;
    const d = dx * dx + dy * dy;
    if (d > far || (d === far && b.y * map.width + b.x > best!.y * map.width + best!.x)) continue;
    let fits = true;
    for (let y = b.y; y < b.y + b.h && fits; y += 1)
      for (let x = b.x; x < b.x + b.w && fits; x += 1)
        fits =
          freeTile(world, content, x, y) &&
          !fields.has(y * map.width + x) &&
          Math.max(Math.abs(x - green.x), Math.abs(y - green.y)) > ring;
    if (fits) [best, far] = [b, d];
  }
  if (!best) return undefined;
  const tiles: [number, number][] = [];
  for (let y = best.y; y < best.y + best.h; y += 1)
    for (let x = best.x; x < best.x + best.w; x += 1) tiles.push([x, y]);
  return { tiles, w: best.w, h: best.h };
}

/** Lays out the field's granary (`field.granaryLaid`, citing `cause`, the harvest line) unless it
 * has one or finds no ground; the crop it is named for is the field's, else just "the field". */
export function layOutGranary(ctx: SystemContext, f: EntityRow, cause: number): void {
  const { world, content } = ctx;
  if (granaryFor(world, f.id)) return;
  const site = siteGranary(ctx, f);
  if (!site) return;
  const crop = f['crop'] ? cropOf(content, f['crop'] as string) : undefined;
  const plate = content.work.stock.find((s) => s.good === 'food')?.name ?? 'food';
  const made = ctx.emit('field.granaryLaid', {
    causes: [cause],
    data: {
      where: crop ? `the ${crop.name} field` : 'the field',
      plate: plate.charAt(0).toUpperCase() + plate.slice(1),
      width: site.w,
      height: site.h,
    },
  });
  addGranary(world, f.id, site.tiles, made);
}

const nearField = (world: WorldState, f: EntityRow, x: number, y: number): number => {
  const i = tilesOf(f)[0]!;
  return Math.max(
    Math.abs((i % world.map.width) - x),
    Math.abs(Math.floor(i / world.map.width) - y),
  );
};

/** Each hour: food lying outside the store with the store at its plate and no granary to take it
 * gets the nearest field without one a granary (a field whose harvest found no ground before). */
export function tickGranaries(ctx: SystemContext): void {
  const { world, content } = ctx;
  // Only a field that has been reaped: a granary is laid for a harvest, not for berries.
  const bare = liveFields(world).filter(
    (f) => (f['got'] as number) > 0 && !granaryFor(world, f.id),
  );
  if (!bare.length) return;
  const enough = storedEnough(world, content);
  const loose = itemsOf(world).find(
    (i) =>
      !i['holder'] &&
      keepable(content, i['kind'] as string) &&
      !inStore(world, i['x'] as number, i['y'] as number, i['z'] as number) &&
      !inGranary(world, i['x'] as number, i['y'] as number, i['z'] as number) &&
      enough(i),
  );
  if (!loose) return;
  const [x, y] = [loose['x'] as number, loose['y'] as number];
  const f = [...bare].sort(
    (a, b) => nearField(world, a, x, y) - nearField(world, b, x, y) || a.id - b.id,
  )[0]!;
  layOutGranary(ctx, f, f['last'] as number);
}
