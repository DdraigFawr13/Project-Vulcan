// Nursing (P5.6, V-114), the Healing row of the Work sheet. In work hours a free, able person
// who puts Healing high enough to reach it takes up dressing: a deep or grave wound not dressed
// for `heal.dressEvery` hours, or one only roughly bound (which they bind properly: a line).
// Dressing is daily work, not a line. Feeding the hurt is feed.ts.
import type { EntityRow, WorldState } from '../core/index.ts';
import { bodyOf, openWounds, severityOf } from '../health/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bindWounds } from './care.ts';
import { practise } from './learn.ts';
import { able } from './priority.ts';
import { people, skillOf, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

const far = (a: Spot, b: Spot): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 100;

const personOf = (world: WorldState, id: number): EntityRow | undefined =>
  people(world).find((p) => p.id === id);

/** Others on `job` for whom. */
const tended = (world: WorldState, p: EntityRow, job: string, field: string): Set<number> =>
  new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === job)
      .map((q) => q[field] as number),
  );

/** The wounds of `person` a healer should see to now. */
function toDress(ctx: SystemContext, person: number): EntityRow[] {
  const { world, content } = ctx;
  const every = content.health.heal.dressEvery * 60;
  return openWounds(world, person).filter(
    (w) =>
      severityOf(content, w).bleed > 0 &&
      ((w['bound'] as number) < 2 || world.tick - (w['dressed'] as number) >= every),
  );
}

/** Nursing: dressing the wounds of the nearest hurt person due a dressing. */
export function takeUpNursing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const from = spotOf(p);
  const reach = (q: EntityRow) => canReach(content, world.map, from, spotOf(q));
  const nearest = (list: EntityRow[]) =>
    [...list].sort((a, b) => far(spotOf(a), from) - far(spotOf(b), from) || a.id - b.id)[0];
  const hurt = people(world).filter(
    (q) => q.id !== p.id && q['status'] === 'alive' && !bodyOf(world, q.id)?.['carrier'],
  );
  if (able(content, p, content.health.care.job)) {
    const busy = tended(world, p, 'dress', 'target');
    const q = nearest(hurt.filter((q) => !busy.has(q.id) && toDress(ctx, q.id).length && reach(q)));
    if (q && walkTo(ctx, p, spotOf(q))) {
      Object.assign(p, { job: 'dress', target: q.id, work: -1 });
      return true;
    }
  }
  return false;
}

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', target: -1, plan: 0, what: '', work: 0 });
  return false;
};

/** One minute of dressing; false when it ended. */
export function dressing(ctx: SystemContext, h: EntityRow): boolean {
  const { world, content } = ctx;
  const p = personOf(world, h['target'] as number);
  const wounds = p && p['status'] === 'alive' ? toDress(ctx, p.id) : [];
  if (!p || !wounds.length || bodyOf(world, p.id)?.['carrier']) return stop(h);
  if ((h['path'] as number[]).length) return true;
  if (far(spotOf(h), spotOf(p)) > 1) return walkTo(ctx, h, spotOf(p)) || stop(h);
  const care = content.health.care;
  const skill = content.jobs.find((j) => j.id === care.job)?.skill ?? '';
  if ((h['work'] as number) < 0)
    h['work'] = Math.ceil(
      (care.dress * 2 * care.skilled) / (care.skilled + skillOf(world, h, skill)),
    );
  h['work'] = (h['work'] as number) - 1;
  practise(ctx, h, skill, 0);
  if ((h['work'] as number) > 0) return true;
  const rough = wounds.filter((w) => (w['bound'] as number) < 2);
  if (rough.length) bindWounds(ctx, h, p, rough);
  for (const w of wounds) Object.assign(w, { dressed: world.tick, healer: h.id });
  stop(h);
  return true;
}
