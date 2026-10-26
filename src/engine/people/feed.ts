// Feeding the hurt (P5.6): someone lying hurt cannot fetch food. When their food is under its
// `seek` line, the nearest free person awake who can get to them fetches food (the nearest that
// is not food of last resort) and brings enough to fill them, fed one after another at the bed;
// it is on the danger rung, so it comes before their own work. Not a line: the hunger line, if one
// comes, is the needs system's.
import type { EntityRow, WorldState } from '../core/index.ts';
import { itemsOf } from '../goods/index.ts';
import { bodiesOf, isDown } from '../health/index.ts';
import { needOf } from '../needs/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { eat } from './eat.ts';
import { fetchKind } from './fetch.ts';
import { people, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

const far = (a: Spot, b: Spot): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 100;

const hungry = (ctx: SystemContext, person: number): boolean => {
  const seek = ctx.content.life.needs.find((n) => n.id === 'food')?.seek ?? 0;
  return ((needOf(ctx.world, person, 'food')?.['value'] as number) ?? seek) < seek;
};

/** The kind of the nearest food `p` can reach that is not food of last resort. */
function foodFor(ctx: SystemContext, p: EntityRow): string | undefined {
  const { world, content } = ctx;
  const from = spotOf(p);
  const food = itemsOf(world)
    .filter(
      (i) =>
        !i['holder'] &&
        content.life.eat[i['kind'] as string] !== undefined &&
        !content.life.lastResort.includes(i['kind'] as string),
    )
    .sort((a, b) => far(spotOf(a), from) - far(spotOf(b), from) || a.id - b.id)
    .find((i) => canReach(content, world.map, from, spotOf(i)));
  return food?.['kind'] as string | undefined;
}

/** Each minute: a hungry person lying hurt that nobody is feeding gets the nearest of `free`
 * (awake, standing, on no care work) to bring them food. */
export function seekFeeders(
  ctx: SystemContext,
  free: (q: EntityRow, p: EntityRow) => boolean,
  answer: (q: EntityRow, p: EntityRow) => void,
): void {
  const { world, content } = ctx;
  const fed = new Set(
    people(world)
      .filter((q) => q['job'] === 'feed')
      .map((q) => q['plan']),
  );
  for (const b of bodiesOf(world)) {
    const p = people(world).find((q) => q.id === b['person']);
    if (!p || p['status'] !== 'alive' || !b['down'] || b['carrier'] || fed.has(p.id)) continue;
    if (!hungry(ctx, p.id)) continue;
    const at = spotOf(p);
    const q = people(world)
      .filter((r) => free(r, p) && r['doing'] !== 'sleep')
      .filter((r) => canReach(content, world.map, spotOf(r), at))
      .sort((a, c) => far(spotOf(a), at) - far(spotOf(c), at) || a.id - c.id)
      .find((r) => foodFor(ctx, r));
    if (!q) continue;
    answer(q, p);
    const what = foodFor(ctx, q)!;
    // Enough to fill them (a trip to the stores can be long), within one load.
    const value = (needOf(world, p.id, 'food')?.['value'] as number) ?? 0;
    const gives = content.life.eat[what] ?? 1;
    const count = Math.min(content.work.haul.load, Math.ceil((content.life.scale - value) / gives));
    Object.assign(q, { plan: p.id, what, target: -1, work: Math.max(1, count) });
    fed.add(p.id);
  }
}

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', target: -1, plan: 0, what: '', work: 0 });
  return false;
};

const lying = (world: WorldState, p: EntityRow | undefined): p is EntityRow =>
  !!p && p['status'] === 'alive' && isDown(world, p.id);

/** One minute of bringing food to someone abed; false when it ended. */
export function feeding(ctx: SystemContext, q: EntityRow): boolean {
  const { world } = ctx;
  const p = people(world).find((r) => r.id === q['plan']);
  if (!lying(world, p)) return stop(q);
  if ((q['path'] as number[]).length) return true;
  const kind = q['what'] as string;
  const held = () => itemsOf(world).find((i) => i['holder'] === q.id && i['kind'] === kind);
  const got = fetchKind(ctx, q, kind, Math.max(1, q['work'] as number));
  if (got === 'walking') return true;
  // No more lies about: what they already carry is still brought.
  if (got === 'none' && !held()) return stop(q);
  if (far(spotOf(q), spotOf(p)) > 1) return walkTo(ctx, q, spotOf(p)) || stop(q);
  const scale = ctx.content.life.scale;
  const gives = ctx.content.life.eat[kind] ?? 0;
  for (let item = held(); item; item = held()) {
    const value = (needOf(world, p.id, 'food')?.['value'] as number) ?? scale;
    if (value > scale - gives / 2) break;
    eat(ctx, p, item);
  }
  // Whatever is left over is laid by the bed for the next meal.
  const left = held();
  if (left) Object.assign(left, { ...spotOf(q), holder: 0 });
  stop(q);
  return true;
}
