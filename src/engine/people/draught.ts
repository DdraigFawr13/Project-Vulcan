// Draughts (P5.7, V-136), Healing row work in work hours: a free, able person who puts Healing
// high enough takes a draught to the nearest person abed sick who has had none for
// `sick.draughtEvery` hours. Like feeding, it comes before other new work, for whoever free puts
// Healing highest, unless they put it last (`draughtFirst`); Healing is last in the Work sheet's
// order, so under the start levels it would otherwise never come round. A draught is one herb from the store: it takes `skillCut` off every
// 100 of a grave case's death chance per herbalism point (at most `cutMost`), and the first one
// shortens the rest of the illness by `shorten` a point (at most `shortenMost`). With no herbs the
// healer nurses them only (`nurseCut` a point) and the bout is marked herbless, which the herb
// garden reads (build/herbs.ts). Nursing a catching illness may give it to the healer.
import type { EntityRow, WorldState } from '../core/index.ts';
import { boutOf, bodyOf, expose, illDef } from '../health/index.ts';
import { inStore, itemsOf, takeFrom } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { able, levelOf, outranked } from './priority.ts';
import { people, skillOf, spotOf } from './spots.ts';
import { worked } from './tools.ts';
import { walkTo } from './walk.ts';

const far = (a: Spot, b: Spot): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 100;

const due = (ctx: SystemContext, q: EntityRow): boolean => {
  const { world, content } = ctx;
  const bout = boutOf(world, q.id);
  if (q['status'] !== 'alive' || bout?.['state'] !== 'sick') return false;
  if (!illDef(content, bout['ill'] as string)?.abed || bodyOf(world, q.id)?.['carrier'])
    return false;
  const last = bout['draught'] as number;
  return !last || world.tick - last >= content.health.sick.draughtEvery * 60;
};

/** Takes up a draught for the nearest sick person due one that nobody else is bringing. */
export function takeUpDraught(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const from = spotOf(p);
  const busy = new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === 'draught')
      .map((q) => q['target'] as number),
  );
  const q = people(world)
    .filter((q) => q.id !== p.id && !busy.has(q.id) && due(ctx, q))
    .filter((q) => canReach(content, world.map, from, spotOf(q)))
    .sort((a, b) => far(spotOf(a), from) - far(spotOf(b), from) || a.id - b.id)[0];
  if (!q || !walkTo(ctx, p, spotOf(q))) return false;
  Object.assign(p, { job: 'draught', target: q.id, work: -1 });
  return true;
}

/** Before other new work: a draught due, unless they put Healing last or someone free puts it
 * higher. */
export function draughtFirst(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const job = content.health.care.job;
  if (!able(content, p, job)) return false;
  if (levelOf(world, content, p.id, job) >= content.work.priority.words.length) return false;
  return !outranked(ctx, p, job, () => true) && takeUpDraught(ctx, p);
}

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', target: -1, work: 0 });
  return false;
};

const herbsIn = (world: WorldState, item: string): EntityRow[] =>
  itemsOf(world).filter(
    (i) =>
      i['kind'] === item &&
      !i['holder'] &&
      inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
  );

/** One minute of bringing a draught; false when it ended. */
export function dosing(ctx: SystemContext, h: EntityRow): boolean {
  const { world, content } = ctx;
  const p = people(world).find((q) => q.id === h['target']);
  if (!p || !due(ctx, p)) return stop(h);
  if ((h['path'] as number[]).length) return true;
  if (far(spotOf(h), spotOf(p)) > 1) return walkTo(ctx, h, spotOf(p)) || stop(h);
  const care = content.health.care;
  const s = content.health.sick;
  const skillId = content.jobs.find((j) => j.id === care.job)?.skill ?? '';
  const skill = skillOf(world, h, skillId);
  if ((h['work'] as number) < 0)
    h['work'] = Math.ceil((s.draught * 2 * care.skilled) / (care.skilled + skill));
  h['work'] = (h['work'] as number) - 1;
  practise(ctx, h, skillId, 0);
  worked(ctx, h, care.job);
  if ((h['work'] as number) > 0) return true;
  const bout = boutOf(world, p.id)!;
  const def = illDef(content, bout['ill'] as string)!;
  const stacks = herbsIn(world, content.health.herbs.item);
  const first = !bout['draught'];
  const data = { healer: h['name'] as string, name: p['name'] as string, ill: def.name };
  const causes = [bout['line'] as number].filter((c) => c > 0);
  let cut = Math.min(s.cutMost, s.nurseCut * skill);
  if (stacks.length) {
    takeFrom(world, stacks[0]!, 1);
    cut = Math.min(s.cutMost, s.skillCut * skill);
    const left = stacks.reduce((n, i) => n + (i['count'] as number), 0) - 1;
    if (!bout['healer'])
      ctx.emit('health.draught', { causes, actors: [h.id, p.id], data: { ...data, left } });
    if (first) {
      const rest = (bout['ends'] as number) - world.tick;
      const by = Math.min(s.shortenMost, s.shorten * skill);
      bout['ends'] = world.tick + Math.floor((rest * (100 - by)) / 100);
      if ((bout['crisis'] as number) >= (bout['ends'] as number))
        bout['crisis'] = world.tick + Math.floor(((bout['ends'] as number) - world.tick) / 2);
    }
  } else {
    if (!bout['herbless']) ctx.emit('health.noDraught', { causes, actors: [h.id, p.id], data });
    bout['herbless'] = world.tick;
  }
  Object.assign(bout, {
    healer: h.id,
    draught: world.tick,
    cut: Math.max(bout['cut'] as number, cut),
  });
  // Close to a catching illness, the healer may take it.
  if (def.spread && ctx.rng().int(s.per) < def.spread)
    expose(ctx, h, def.id, `nursed ${p['name']}`, causes, { sure: true, from: p.id });
  return stop(h) || true;
}
