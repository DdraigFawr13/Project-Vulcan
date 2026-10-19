// Building (P3.1, P3.2, V-041): nobody is told to build. In working hours a free person able for
// the build job (jobs.json, the Work sheet's Building row) takes up the plan nearest them that
// nobody else is on: they fetch its material from wherever it lies, the store first among
// equals, bring it to the plan, then build from beside it for the part's minutes (shorter with
// building skill). A part to come down is taken down the same way and its material laid back.
// A plan whose material cannot be reached says so once, as an alert, until some is brought.
import type { EngineContent, EntityRow } from '../core/index.ts';
import { finishPlan, nextNeed, planPart, plansOf, refundOf, takeDownPlan } from '../build/index.ts';
import { inStore, itemsAt, itemsOf, layItem, loadOf, storeOf, takeFrom } from '../goods/index.ts';
import { withBuilt } from '../map/index.ts';
import { canReach, reachFrom, walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { busy, layAround, people, same, skillOf, spotOf } from './spots.ts';
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

/** The stacks of `kind` `p` can reach that no one else is fetching, each scored by its distance
 * (one in the store before one lying out at the same distance), in item order. */
export function reachableStacks(
  ctx: SystemContext,
  p: EntityRow,
  kind: string,
): { item: EntityRow; score: number }[] {
  const { world, content } = ctx;
  const others = new Set([
    ...busy(world, p, 'haul'),
    ...busy(world, p, 'build'),
    ...busy(world, p, 'carpentry'),
    ...busy(world, p, 'hearth'),
    ...busy(world, p, 'tend'),
  ]);
  const from = spotOf(p);
  const out: { item: EntityRow; score: number }[] = [];
  for (const i of itemsOf(world)) {
    if (i['kind'] !== kind || i['holder'] || others.has(i.id)) continue;
    const at = spotOf(i);
    const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) * 2;
    if (canReach(content, world.map, from, at))
      out.push({ item: i, score: d + (inStore(world, at.x, at.y, at.z) ? 0 : 1) });
  }
  return out;
}

/** The nearest stack of `kind` `p` can reach that no one else is fetching (also used for
 * furniture wood, carpentry.ts). */
export function stackOf(ctx: SystemContext, p: EntityRow, kind: string): EntityRow | undefined {
  let best: { item: EntityRow; score: number } | undefined;
  for (const s of reachableStacks(ctx, p, kind)) if (!best || s.score < best.score) best = s;
  return best?.item;
}

/** A stack of the material the plan needs next (its own first, then its second). */
const materialFor = (ctx: SystemContext, p: EntityRow, plan: EntityRow) => {
  const next = nextNeed(ctx.content, plan);
  return next && stackOf(ctx, p, next.material);
};

/** Whether a tree or log still stands on the plan's tile, to be felled first (a house's site,
 * P3.7). */
function standing(ctx: SystemContext, plan: EntityRow): boolean {
  const map = ctx.world.map;
  const f = map.features[(plan['y'] as number) * map.width + (plan['x'] as number)]!;
  const kind = f ? ctx.content.features[f - 1]!.kind : '';
  return kind === 'tree' || kind === 'log';
}

/** The plan `p` would take up: the nearest free one (ties by plan) that has its material, or
 * whose material they can reach, with no tree left on it, and that they can get beside. */
function choosePlan(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const others = taken(ctx, p);
  const from = spotOf(p);
  const open = plansOf(world)
    .filter(
      (r) =>
        r['state'] !== 'built' &&
        !others.has(r.id) &&
        r['z'] === from.z &&
        world.tick >= (r['held'] as number) &&
        !standing(ctx, r),
    )
    .map((r) => {
      const d = Math.max(
        Math.abs((r['x'] as number) - from.x),
        Math.abs((r['y'] as number) - from.y),
      );
      return [d, r] as const;
    })
    .sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
  for (const [, r] of open) {
    if (nextNeed(content, r) && !materialFor(ctx, p, r)) continue;
    if (besideReachable(ctx, p, r)) return r;
  }
  return undefined;
}

/** The eight tiles round a plan's tile: a builder works from any of them, so the corner of a
 * house is built from inside, across the corner, when its outside is shut in by trees. */
const AROUND = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** The tiles round a plan `p` could stand on and reach, nearest them first. */
function standsFor(ctx: SystemContext, p: EntityRow, x: number, y: number) {
  const map = ctx.world.map;
  const here = spotOf(p);
  return AROUND.map(([dx, dy]) => ({ x: x + dx, y: y + dy, z: 0 }))
    .filter((s) => s.x >= 0 && s.y >= 0 && s.x < map.width && s.y < map.height)
    .filter((s) => walkAt(ctx.content, map, 0, s.y * map.width + s.x) > 0)
    .sort(
      (a, b) =>
        Math.max(Math.abs(a.x - here.x), Math.abs(a.y - here.y)) -
        Math.max(Math.abs(b.x - here.x), Math.abs(b.y - here.y)),
    )
    .filter((s) => same(s, here) || canReach(ctx.content, map, here, s));
}

/** Whether `p` can stand next to the plan's tile. */
function besideReachable(ctx: SystemContext, p: EntityRow, plan: EntityRow): boolean {
  return standsFor(ctx, p, plan['x'] as number, plan['y'] as number).length > 0;
}

/** Sets off to stand next to the plan's tile; false when nowhere next to it can be reached. */
function goBeside(ctx: SystemContext, p: EntityRow, x: number, y: number): boolean {
  for (const s of standsFor(ctx, p, x, y)) if (same(s, spotOf(p)) || walkTo(ctx, p, s)) return true;
  return false;
}

/** Plans that need material none of which can be reached, and none of which is on its way, say
 * so: one line per material while plans wait for it (the other waiting plans name the same line),
 * again only once some has been brought and they run short anew. */
function sayWaiting(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const plans = plansOf(world);
  // Material someone carries or has gone for is on its way, so nothing waits for it yet.
  const fetching = new Set([
    ...busy(world, p, 'haul'),
    ...busy(world, p, 'build'),
    ...busy(world, p, 'carpentry'),
    ...busy(world, p, 'hearth'),
  ]);
  const onItsWay = (kind: string) =>
    itemsOf(world).some((i) => i['kind'] === kind && (i['holder'] || fetching.has(i.id)));
  for (const r of plans) {
    const next = nextNeed(content, r);
    if (r['waited'] || !next || materialFor(ctx, p, r)) continue;
    const part = planPart(content, r);
    if (onItsWay(next.material)) continue;
    const same = plans.find((o) => o['waited'] && nextNeed(content, o)?.material === next.material);
    const good = content.items.find((i) => i.id === next.material)?.name ?? next.material;
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
  const beside = here.z === 0 && Math.max(Math.abs(here.x - x), Math.abs(here.y - y)) === 1;
  const next = nextNeed(content, plan);
  const load = loadOf(world, p.id);
  if (load && (!next || load['kind'] !== next.material)) return stop(p);
  if (load && next) {
    if (!beside) return goBeside(ctx, p, x, y) || stop(p);
    const used = Math.min(next.count, load['count'] as number);
    const field = next.material === part.material ? 'have' : 'also';
    plan[field] = (plan[field] as number) + used;
    plan['waited'] = 0;
    takeFrom(world, load, used);
    return true;
  }
  if (next) return fetchMaterial(ctx, p, plan, next.count);
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
  if (part.kind === 'wall' && wouldShut(ctx, p, plan)) return shutOut(ctx, p, plan);
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

/** Whether the wall would cut the builder off from someone, or from a store tile, they can reach
 * now: a wall closing a ring round people or the store without a door. */
function wouldShut(ctx: SystemContext, p: EntityRow, plan: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const spots = [
    ...people(world)
      .filter((q) => q.id !== p.id)
      .map(spotOf),
    ...storeOf(world).map(spotOf),
  ].filter((s) => s.z === 0);
  const now = reachFrom(content, map, spotOf(p));
  const reached = spots.filter(now);
  if (!reached.length) return false;
  const part = content.buildings.parts.indexOf(planPart(content, plan)) + 1;
  return withBuilt(map, plan['x'] as number, plan['y'] as number, part, () => {
    const after = reachFrom(content, map, spotOf(p));
    return reached.some((s) => !after(s));
  });
}

/** The wall waits: said once a plan, and nobody tries it again for an hour. */
function shutOut(ctx: SystemContext, p: EntityRow, plan: EntityRow): boolean {
  if (!plan['shut'])
    plan['shut'] = ctx.emit('build.shutIn', {
      causes: [plan['line'] as number],
      data: {
        part: planPart(ctx.content, plan).name,
        x: plan['x'] as number,
        y: plan['y'] as number,
      },
    });
  plan['held'] = ctx.world.tick + 60;
  stop(p);
  return true;
}

/** The part comes down and its material lies around its tile. */
function takeDown(ctx: SystemContext, p: EntityRow, plan: EntityRow): boolean {
  const { content } = ctx;
  const part = planPart(content, plan);
  const at = { x: plan['x'] as number, y: plan['y'] as number, z: 0 };
  const name = (id: string): string => content.items.find((i) => i.id === id)?.name ?? id;
  // Both materials of a two-material part, as "4 clay and 1 log" (those with something to give).
  const back = refundOf(content, plan)
    .filter((r) => r.count > 0)
    .map((r) => `${r.count} ${name(r.kind)}`);
  const line = ctx.emit('build.takenDown', {
    causes: [p['took'] as number, plan['line'] as number],
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, part: part.name, x: at.x, y: at.y },
      back:
        back.length > 1
          ? `${back.slice(0, -1).join(', ')} and ${back.at(-1)}`
          : (back[0] ?? 'nothing'),
    },
  });
  for (const { kind, count } of takeDownPlan(ctx, plan, line))
    if (count > 0) layAround(ctx, kind, count, at, line);
  stop(p);
  return true;
}
