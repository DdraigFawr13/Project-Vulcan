// Nursing (P5.6, V-114), the Healing row of the Work sheet. In work hours a free, able person
// who puts Healing high enough to reach it takes up dressing: a deep or grave wound not dressed
// for `heal.dressEvery` hours, or one only roughly bound (which they bind properly: a line).
// Dressing is daily work, not a line, except a wound's first dressing with herbs (one herb from
// the store, `health.herbs`) and the first that wanted herbs and found none. Feeding the hurt is feed.ts.
import type { EntityRow, WorldState } from '../core/index.ts';
import { bodyOf, openWounds, severityOf, woundName } from '../health/index.ts';
import { inStore, itemsOf, takeFrom } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bindWounds } from './care.ts';
import { takeUpDraught } from './draught.ts';
import { sew } from './surgery.ts';
import { worked } from './tools.ts';
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
    (q) =>
      q.id !== p.id &&
      q['status'] === 'alive' &&
      !bodyOf(world, q.id)?.['carrier'] &&
      !bodyOf(world, q.id)?.['healer'],
  );
  if (able(content, p, content.health.care.job)) {
    const busy = tended(world, p, 'dress', 'target');
    const q = nearest(hurt.filter((q) => !busy.has(q.id) && toDress(ctx, q.id).length && reach(q)));
    if (q && walkTo(ctx, p, spotOf(q))) {
      Object.assign(p, { job: 'dress', target: q.id, work: -1 });
      return true;
    }
    if (takeUpDraught(ctx, p)) return true;
  }
  return false;
}

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', target: -1, plan: 0, what: '', work: 0 });
  return false;
};

/** A dressing may use one herb on a young wound not herbed within `herbs.every` days: taken from
 * the store when it has one, else the wound is marked herbless. A line the first time each. */
function herbDress(ctx: SystemContext, h: EntityRow, p: EntityRow, w: EntityRow): void {
  const { world, content } = ctx;
  const herbs = content.health.herbs;
  const day = 1440;
  if (world.tick - (w['at'] as number) >= herbs.days * day) return;
  if ((w['herbed'] as number) > 0 && world.tick - (w['herbed'] as number) < herbs.every * day)
    return;
  const stacks = itemsOf(world).filter(
    (i) =>
      i['kind'] === herbs.item &&
      !i['holder'] &&
      inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
  );
  const data = {
    healer: h['name'] as string,
    name: p['name'] as string,
    wound: woundName(content, w),
  };
  const causes = [w['care'] as number].filter((c) => c > 0);
  if (!stacks.length) {
    if (!w['herbless']) ctx.emit('health.noHerbs', { causes, actors: [h.id, p.id], data });
    w['herbless'] = world.tick;
    return;
  }
  takeFrom(world, stacks[0]!, 1);
  const left = stacks.reduce((n, i) => n + (i['count'] as number), 0) - 1;
  if (!w['herbed'])
    ctx.emit('health.herbed', { causes, actors: [h.id, p.id], data: { ...data, left } });
  w['herbed'] = world.tick;
}

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
  worked(ctx, h, care.job);
  if ((h['work'] as number) > 0) return true;
  const rough = wounds.filter((w) => (w['bound'] as number) < 2);
  if (rough.length) bindWounds(ctx, h, p, rough);
  for (const w of wounds) {
    Object.assign(w, { dressed: world.tick, healer: h.id });
    herbDress(ctx, h, p, w);
  }
  sew(ctx, h, p, wounds);
  stop(h);
  return true;
}
