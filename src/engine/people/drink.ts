// Drinking (P5.2, V-131): when water is under its `seek` line a person walks beside the nearest
// unfrozen drinkable surface water or a well and drinks to full. No line per drink (V-036); the
// need's own lines (`need.low`, `need.met`) say when thirst bites, and each drink, with the minutes
// walked to it, is noted for the colony's well (build/well.ts). A foul drink may bring the flux,
// and water shunned after one is passed over (foul.ts, P5.7).
import type { EntityRow } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import { noteDrink, waterSpots } from '../build/index.ts';
import { changeNeed, crossed, needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isFrozen } from '../weather/index.ts';
import { shunned } from '../health/index.ts';
import { drankAt } from '../care/index.ts';
import { lineOf, goBeside, spotOf } from '../band/index.ts';

export const DRINK_FIELDS = {
  /** While drinking: the tile (index + 1) they drink from, else 0. */
  drinkAt: 'int',
  /** Minutes walked to it so far. */
  drinkMin: 'int',
  /** The tick before which they do not look for water again after finding none. */
  thirst: 'int',
  /** 1 while a drink was gone for from their leisure: the walk is part of it (needs). */
  stroll: 'int',
} as const;

const RETRY = 60;
/** How many of the nearest spots are tried for a way to stand beside. */
const TRIES = 40;

/** Sets off beside the nearest water or well they can reach; the tile (index + 1) or 0. */
function goDrink(ctx: SystemContext, p: EntityRow): number {
  const { world, content } = ctx;
  const here = spotOf(p);
  const map = world.map;
  const spots = waterSpots(world, content);
  // Water shunned after a flux there (P5.7) is passed over while there is other water.
  const shun = shunned(world, content);
  const clean = spots.filter((s) => !shun(s.y * map.width + s.x));
  const near = nearest(clean.length ? clean : spots, here, TRIES);
  for (const s of near) if (goBeside(ctx, p, s.x, s.y)) return s.y * map.width + s.x + 1;
  return 0;
}

/** The first `n` spots by distance from `here` (corners count one), then row, then column, in
 * the order a stable sort of them all would give, without sorting them all. */
function nearest(spots: readonly Spot[], here: Spot, n: number): Spot[] {
  const out: Spot[] = [];
  const far: number[] = [];
  // Whether spot `s` at distance `d` sorts at or after the kept spot `k`.
  const after = (s: Spot, d: number, k: number): boolean =>
    d > far[k]! || (d === far[k] && (s.y - out[k]!.y || s.x - out[k]!.x) >= 0);
  for (const s of spots) {
    const d = Math.max(Math.abs(s.x - here.x), Math.abs(s.y - here.y));
    if (out.length === n && after(s, d, n - 1)) continue;
    let at = out.length;
    while (at > 0 && !after(s, d, at - 1)) at -= 1;
    out.splice(at, 0, s);
    far.splice(at, 0, d);
    if (out.length > n) [out.pop(), far.pop()];
  }
  return out;
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
      drankAt(ctx, p, i);
      changeNeed(content, row, content.life.scale);
      crossed(ctx, p, row, def);
    } else p['thirst'] = world.tick + RETRY;
    Object.assign(p, { doing: '', drinkAt: 0, drinkMin: 0, stroll: 0 });
    return false;
  }
  // Asleep, only real thirst (under the warning line) gets them up.
  const seek = p['doing'] === 'sleep' ? def.low : lineOf(ctx, p, 'water');
  if ((row['value'] as number) >= seek || world.tick < (p['thirst'] as number)) return false;
  const at = goDrink(ctx, p);
  if (!at) {
    p['thirst'] = world.tick + RETRY;
    return false;
  }
  Object.assign(p, {
    doing: 'drink',
    drinkAt: at,
    drinkMin: 0,
    stroll: p['doing'] === 'relax' ? 1 : 0,
  });
  return true;
}
