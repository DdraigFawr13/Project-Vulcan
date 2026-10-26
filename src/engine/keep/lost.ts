// What food was lost in the last few weeks (P5.12, V-132): each weekly line also leaves a
// `spoilWeek` row per kind, kept `keep.history` weeks, so a need can say "this much spoiled" and
// cite the line that said it.
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { removeEntity, addEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

const rows = (world: WorldState): EntityRow[] => world.entities['spoilWeek'] ?? [];

/** Records a store's week (`mine`, its `spoilage` rows) under the line that said it, and drops
 * the weeks older than `keep.history`. */
export function noteWeek(
  ctx: SystemContext,
  store: number,
  mine: readonly EntityRow[],
  line: number,
): void {
  const { world, content } = ctx;
  const keep = content.work.keep;
  const week = Math.floor(world.tick / TICKS_PER_DAY / keep.week);
  for (const r of mine)
    addEntity(world, 'spoilWeek', {
      week,
      store,
      kind: r['kind'] as string,
      count: r['count'] as number,
      line,
    });
  for (const r of [...rows(world)])
    if ((r['week'] as number) <= week - keep.history) removeEntity(world, 'spoilWeek', r.id);
}

/** `stores`: any store or the open, only walled stores, or the one store with that id. */
type Where = 'any' | 'walled' | number;

const counted = (world: WorldState, kinds: readonly string[], where: Where): EntityRow[] =>
  rows(world).filter(
    (r) =>
      kinds.includes(r['kind'] as string) &&
      (where === 'any' || (where === 'walled' ? (r['store'] as number) > 0 : r['store'] === where)),
  );

/** How many of `kinds` were lost over the kept weeks: at any store or in the open, only at walled
 * stores, or at one store. */
export const lostOf = (
  world: WorldState,
  kinds: readonly string[],
  stores: Where = 'any',
): number => counted(world, kinds, stores).reduce((n, r) => n + (r['count'] as number), 0);

/** The latest weekly line that lost one of `kinds`, if any. */
export function lostLine(
  world: WorldState,
  kinds: readonly string[],
  stores: Where = 'any',
): number | undefined {
  let best: EntityRow | undefined;
  for (const r of counted(world, kinds, stores))
    if (
      !best ||
      (r['week'] as number) > (best['week'] as number) ||
      ((r['week'] as number) === (best['week'] as number) &&
        (r['line'] as number) > (best['line'] as number))
    )
      best = r;
  return best?.['line'] as number | undefined;
}
