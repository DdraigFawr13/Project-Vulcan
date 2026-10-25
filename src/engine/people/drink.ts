// Drinking (P5.2, V-131): when water is under its `seek` line a person walks beside the nearest
// unfrozen drinkable surface water or a well and drinks to full. No line per drink (V-036); the
// need's own lines (`need.low`, `need.met`) say when thirst bites, and each drink, with the minutes
// walked to it, is noted for the colony's well (build/well.ts).
import type { EntityRow } from '../core/index.ts';
import { noteDrink, waterSpots } from '../build/index.ts';
import { changeNeed, crossed, needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isFrozen } from '../weather/index.ts';
import { goBeside, spotOf } from './spots.ts';

export const DRINK_FIELDS = {
  /** While drinking: the tile (index + 1) they drink from, else 0. */
  drinkAt: 'int',
  /** Minutes walked to it so far. */
  drinkMin: 'int',
  /** The tick before which they do not look for water again after finding none. */
  thirst: 'int',
} as const;

const RETRY = 60;
/** How many of the nearest spots are tried for a way to stand beside. */
const TRIES = 40;

/** Sets off beside the nearest water or well they can reach; the tile (index + 1) or 0. */
function goDrink(ctx: SystemContext, p: EntityRow): number {
  const { world, content } = ctx;
  const here = spotOf(p);
  const map = world.map;
  const near = waterSpots(world, content)
    .map((s) => [Math.max(Math.abs(s.x - here.x), Math.abs(s.y - here.y)), s] as const)
    .sort((a, b) => a[0] - b[0] || a[1].y - b[1].y || a[1].x - b[1].x);
  for (const [, s] of near.slice(0, TRIES))
    if (goBeside(ctx, p, s.x, s.y)) return s.y * map.width + s.x + 1;
  return 0;
}

/** One minute of the drinking errand; true while it takes their minute. */
export function drinking(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.life.needs.find((n) => n.id === 'water');
  const row = needOf(world, p.id, 'water');
  if (!def || !row) return false;
  if (p['doing'] === 'drink') {
    if ((p['path'] as number[]).length) {
      p['drinkMin'] = (p['drinkMin'] as number) + 1;
      return true;
    }
    const i = (p['drinkAt'] as number) - 1;
    const w = world.map.width;
    const beside =
      Math.abs((i % w) - (p['x'] as number)) + Math.abs(Math.floor(i / w) - (p['y'] as number)) <=
      1;
    if (i >= 0 && p['z'] === 0 && beside && !isFrozen(world.map, i)) {
      noteDrink(world, i, p['drinkMin'] as number);
      changeNeed(content, row, content.life.scale);
      crossed(ctx, p, row, def);
    } else p['thirst'] = world.tick + RETRY;
    Object.assign(p, { doing: '', drinkAt: 0, drinkMin: 0 });
    return false;
  }
  if ((row['value'] as number) >= def.seek || world.tick < (p['thirst'] as number)) return false;
  const at = goDrink(ctx, p);
  if (!at) {
    p['thirst'] = world.tick + RETRY;
    return false;
  }
  Object.assign(p, { doing: 'drink', drinkAt: at, drinkMin: 0 });
  return true;
}
