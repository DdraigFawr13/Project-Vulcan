// Building (P3.1, P3.2, V-041): nobody is told to build. In working hours a free person able for
// the build job (jobs.json, the Work sheet's Building row) takes up the plan nearest them that
// nobody else is on: they fetch its material from wherever it lies, the store first among
// equals, bring it to the plan, then build from beside it for the part's minutes (shorter with
// building skill). A part to come down is taken down the same way and its material laid back.
// A plan whose material cannot be reached says so once, as an alert, until some is brought.
import type { EngineContent, EntityRow } from '../core/index.ts';
import { finishPlan, planPart, plansOf, stillNeeded, takeDownPlan } from '../build/index.ts';
import { inStore, itemsAt, itemsOf, layItem, takeFrom } from '../goods/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { busy, goBeside, layAround, people, same, skillOf, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.buildings.job)?.skill ?? '';

const planOf = (ctx: SystemContext, p: EntityRow): EntityRow | undefined =>
  plansOf(ctx.world).find((r) => r.id === p['plan']);

/** The plans other builders are on, so no two take the same tile. */
const taken = (ctx: SystemContext, p: EntityRow): Set<number> =>
  new Set(
    people(ctx.world)
      .filter((q) => q.id !== p.id && q['job'] === 'build')
      .map((q) => q['plan'] as number),
  );

/** The nearest stack of a plan's material `p` can reach that no one else is fetching: one in the
 * store before one lying out at the same distance. */
function materialFor(ctx: SystemContext, p: EntityRow, plan: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const kind = planPart(content, plan).material;
  const others = new Set([...busy(world, p, 'haul'), ...busy(world, p, 'build')]);
  const from = spotOf(p);
  let best: EntityRow | undefined;
  let far = Infinity;
  for (const i of itemsOf(world)) {
    if (i['kind'] !== kind || i['holder'] || others.has(i.id)) continue;
    const at = spotOf(i);
    const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) * 2;
    const score = d + (inStore(world, at.x, at.y, at.z) ? 0 : 1);
    if (score < far && canReach(content, world.map, from, at)) [best, far] = [i, score];
  }
  return best;
}

/** The plan `p` would take up: the nearest free one (ties by plan) that has its material, or
 * whose material they can reach, and that they can get beside. */
function choosePlan(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const others = taken(ctx, p);
  const from = spotOf(p);
  const open = plansOf(world)
    .filter((r) => r['state'] !== 'built' && !others.has(r.id) && r['z'] === from.z)
    .map((r) => {
      const d = Math.max(
        Math.abs((r['x'] as number) - from.x),
        Math.abs((r['y'] as number) - from.y),
      );
      return [d, r] as const;
    })
    .sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
  for (const [, r] of open) {
    if (stillNeeded(content, r) > 0 && !materialFor(ctx, p, r)) continue;
    if (besideReachable(ctx, p, r)) return r;
  }
  return undefined;
}

/** Whether `p` can stand on a side of the plan's tile. */
function besideReachable(ctx: SystemContext, p: EntityRow, plan: EntityRow): boolean {
  const map = ctx.world.map;
  const [x, y] = [plan['x'] as number, plan['y'] as number];
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => {
    const s = { x: x + dx!, y: y + dy!, z: 0 };
    if (s.x < 0 || s.y < 0 || s.x >= map.width || s.y >= map.height) return false;
    return canReach(ctx.content, map, spotOf(p), s);
  });
}

/** Plans that need material none of which can be reached say so: one line per material while
 * plans wait for it (the other waiting plans name the same line), again only once some has been
 * brought and they run short anew. */
function sayWaiting(ctx: SystemContext, p: EntityRow): void {
  const { content } = ctx;
  const plans = plansOf(ctx.world);
  for (const r of plans) {
    if (r['waited'] || stillNeeded(content, r) <= 0 || materialFor(ctx, p, r)) continue;
    const part = planPart(content, r);
    const same = plans.find((o) => o['waited'] && planPart(content, o).material === part.material);
    const good = content.items.find((i) => i.id === part.material)?.name ?? part.material;
    r['waited'] =
      (same?.['waited'] as number | undefined) ??
      ctx.emit('build.waiting', {
        causes: [r['line'] as number],
        data: { part: part.name, x: r['x'] as number, y: r['y'] as number, good },
      });
  }
}

/** Takes up building, if there is a plan for them and nobody free who puts building higher could
 * take it instead. */
export function takeUpBuilding(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const job = content.buildings.job;
  if (!plansOf(world).some((r) => r['state'] !== 'built') || !able(content, p, job)) return false;
  if (outranked(ctx, p, job, (q) => choosePlan(ctx, q) !== undefined)) return false;
  const plan = choosePlan(ctx, p);
  if (!plan) {
    sayWaiting(ctx, p);
    return false;
  }
  const part = planPart(content, plan);
  p['took'] = ctx.emit('work.tookUpBuilding', {
    causes: [
      ...[plan['line'] as number, priorityLine(world, p.id, job)].filter(
        (l): l is number => l !== undefined,
      ),
    ],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      part: part.name,
      x: plan['x'] as number,
      y: plan['y'] as number,
    },
  });
  p['job'] = 'build';
  p['plan'] = plan.id;
  p['target'] = -1;
  return building(ctx, p);
}

/** Minutes a builder of building skill `level` needs for `minutes` of plain work. */
const minutesFor = (content: EngineContent, minutes: number, level: number): number =>
  Math.max(
    1,
    Math.ceil((minutes * 2 * content.buildings.skilled) / (content.buildings.skilled + level)),
  );

/** Stops building: the plan is done, gone or out of reach. */
function stop(p: EntityRow): false {
  p['job'] = '';
  p['plan'] = 0;
  p['target'] = -1;
  return false;
}

/** One minute on the plan they took up; false when it is done, gone or cannot be reached (they
 * look for work again, and anything they carry goes to the store). */
export function building(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const plan = planOf(ctx, p);
  if (!plan || plan['state'] === 'built') return stop(p);
  const part = planPart(content, plan);
  const [x, y] = [plan['x'] as number, plan['y'] as number];
  const here = spotOf(p);
  const beside = here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1;
  const need = stillNeeded(content, plan);
  const load = itemsOf(world).find((i) => i['holder'] === p.id);
  if (load && (need <= 0 || load['kind'] !== part.material)) return stop(p);
  if (load) {
    if (!beside) return goBeside(ctx, p, x, y) || stop(p);
    const used = Math.min(need, load['count'] as number);
    plan['have'] = (plan['have'] as number) + used;
    plan['waited'] = 0;
    takeFrom(world, load, used);
    return true;
  }
  if (need > 0) return fetchMaterial(ctx, p, plan, need);
  if (!beside) return goBeside(ctx, p, x, y) || stop(p);
  const level = skillOf(world, p, skillName(content));
  if ((plan['work'] as number) < 0) {
    const share = plan['state'] === 'down' ? content.buildings.downShare : 100;
    plan['work'] = minutesFor(content, Math.ceil((part.minutes * share) / 100), level);
  }
  if ((plan['work'] as number) > 0) {
    plan['work'] = (plan['work'] as number) - 1;
    practise(ctx, p, skillName(content), p['took'] as number);
  }
  if ((plan['work'] as number) > 0) return true;
  if (plan['state'] === 'down') return takeDown(ctx, p, plan);
  return finish(ctx, p, plan);
}

/** Goes for the plan's material, or picks it up when standing on it. */
function fetchMaterial(ctx: SystemContext, p: EntityRow, plan: EntityRow, need: number): boolean {
  const { world, content } = ctx;
  let item = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!item) {
    item = materialFor(ctx, p, plan);
    if (!item) return stop(p);
    p['target'] = item.id;
  }
  if (!same(spotOf(item), spotOf(p))) return walkTo(ctx, p, spotOf(item)) || stop(p);
  const count = Math.min(need, content.work.haul.load, item['count'] as number);
  if (count === (item['count'] as number)) item['holder'] = p.id;
  else {
    takeFrom(world, item, count);
    const kind = item['kind'] as string;
    const id = layItem(world, { kind, count, ...spotOf(p), made: item['made'] as number });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  p['target'] = -1;
  return true;
}

/** The part is finished, once nobody stands on its tile; a wall or door first moves anything
 * lying there to the ground beside the builder. */
function finish(ctx: SystemContext, p: EntityRow, plan: EntityRow): boolean {
  const { world, content } = ctx;
  const part = planPart(content, plan);
  const at = { x: plan['x'] as number, y: plan['y'] as number, z: 0 };
  if (people(world).some((q) => q.id !== p.id && same(spotOf(q), at))) return true;
  const line = ctx.emit('build.built', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, part: part.name, x: at.x, y: at.y },
  });
  const moved =
    part.kind === 'floor'
      ? []
      : itemsAt(world, at.x, at.y, 0).map((i) => {
          const pile = { kind: i['kind'] as string, count: i['count'] as number };
          takeFrom(world, i, pile.count);
          return pile;
        });
  finishPlan(ctx, plan, line);
  for (const pile of moved) layAround(ctx, pile.kind, pile.count, spotOf(p), line);
  stop(p);
  return true;
}

/** The part comes down and its material lies around its tile. */
function takeDown(ctx: SystemContext, p: EntityRow, plan: EntityRow): boolean {
  const { content } = ctx;
  const part = planPart(content, plan);
  const at = { x: plan['x'] as number, y: plan['y'] as number, z: 0 };
  const back = (plan['done'] as number) > 0 ? part.cost : (plan['have'] as number);
  const good = content.items.find((i) => i.id === part.material)?.name ?? part.material;
  const line = ctx.emit('build.takenDown', {
    causes: [p['took'] as number, plan['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, part: part.name, x: at.x, y: at.y, count: back, good },
  });
  const { kind, count } = takeDownPlan(ctx, plan, line);
  layAround(ctx, kind, count, at, line);
  stop(p);
  return true;
}
