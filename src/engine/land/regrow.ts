// Felled woods grow back (6W Slice 3, V-201): a tree felled for wood comes back on its tile after
// `regrow.years`, if a living tree still stands within `regrow.near` tiles and nothing has been
// put on the tile since; clearings stay clear. The near woods run out, but not for ever.
import { TICKS_PER_DAY } from '../core/index.ts';
import { groundOf, housesOf, inRect, rectOf } from '../build/index.ts';
import { raiseChunk } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Notes a tree felled on tile `i` (its features value `feature`) to grow back when due. */
export function noteFelled(ctx: SystemContext, i: number, feature: number): void {
  const { calendar, terrain } = ctx.content;
  const days = terrain.generator.regrow.years * calendar.daysPerMonth * calendar.monthsPerYear;
  ctx.world.map.regrow.push(i, feature, Math.floor(ctx.world.tick / TICKS_PER_DAY) + days);
}

/** At dawn, each tree due grows back if a living tree stands near and the tile is free; one line
 * for the day's count. Due trees that cannot are dropped. */
export function regrowWoods(ctx: SystemContext): void {
  const { world, content } = ctx;
  const map = world.map;
  if (world.tick % TICKS_PER_DAY !== 0 || !map.regrow.length) return;
  const today = Math.floor(world.tick / TICKS_PER_DAY);
  let due = 0;
  while (due < map.regrow.length && map.regrow[due + 2]! <= today) due += 3;
  if (!due) return;
  const ground = groundOf(world);
  const houses = housesOf(world).map(rectOf);
  const grown: number[] = [];
  for (let k = 0; k < due; k += 3) {
    const i = map.regrow[k]!;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const free =
      map.features[i] === 0 &&
      map.built[i] === 0 &&
      content.terrain.kinds[map.tiles[i]!]!.buildable === true &&
      !ground.taken.has(i) &&
      !ground.items.has(i) &&
      !houses.some((r) => inRect(r, x, y));
    if (free && treeNear(ctx, x, y)) {
      map.features[i] = map.regrow[k + 1]!;
      grown.push(i);
    }
  }
  map.regrow.splice(0, due);
  if (!grown.length) return;
  // The trees' own felling lines are why (each tile's last cause until now).
  const felled = [...new Set(grown.map((i) => map.tileCauses[i]!))].slice(0, 4);
  const line = ctx.emit('land.regrown', {
    causes: felled,
    data: { count: grown.length, trees: grown.length === 1 ? 'tree' : 'trees' },
  });
  for (const i of grown) {
    map.tileCauses[i] = line;
    raiseChunk(map, i % map.width, Math.floor(i / map.width));
  }
}

/** Whether a living tree stands within `regrow.near` tiles of (x, y). */
function treeNear(ctx: SystemContext, x: number, y: number): boolean {
  const { map } = ctx.world;
  const r = ctx.content.terrain.generator.regrow.near;
  for (let dy = -r; dy <= r; dy += 1)
    for (let dx = -r; dx <= r; dx += 1) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const f = map.features[ny * map.width + nx]!;
      if (f && ctx.content.features[f - 1]!.kind === 'tree') return true;
    }
  return false;
}
