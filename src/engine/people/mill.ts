// Grinding and baking (5B Bundle 4, P5.11, V-041, V-133): the Mill heading's Miller and Baker rows.
// Nobody is told to grind or bake. While flour (stored, lying or carried, and what others are
// grinding) is under its plate, a free able person fetches a batch of grain and grinds it at the
// mill while its wheel turns, else at a quern while it has had less than `quern.most` minutes
// today (build/mill.ts notes each minute). While bread is under `bake.perPerson` loaves a person,
// a free able person fetches a batch of flour and a firewood and bakes at the oven, else at the
// nearest hearth (the batch's firewood heats it). Each batch is a ledger line; trips are not.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { furnitureOf, HEARTH, millOf, noteGrind, quernToday, turning } from '../build/index.ts';
import { fireOf, placeOf } from '../fire/index.ts';
import { haveOf, inStore, itemsOf, layItem, loadOf, takeFrom, wantOf } from '../goods/index.ts';
import { canReach, reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { besideReachable, busy, goBeside, layAround, people, same, skillOf } from './spots.ts';
import { spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** Where `p` would work and on what: the piece, the stack to fetch, the batch and its minutes. */
interface Pick {
  piece: EntityRow;
  stack: EntityRow;
  task: 'quern' | 'mill' | 'oven' | 'hearth';
  batch: number;
  minutes: number;
  have: number;
  want: number;
}

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, task: '' });
  return false;
}

const alive = (world: WorldState): number =>
  people(world).filter((q) => q['status'] === 'alive').length;

const countOf = (world: WorldState, kind: string): number =>
  itemsOf(world)
    .filter((i) => i['kind'] === kind)
    .reduce((n, i) => n + (i['count'] as number), 0);

/** Others at the job, each bringing a batch. */
const coming = (world: WorldState, p: EntityRow, job: string, batch: number): number =>
  people(world).filter((q) => q.id !== p.id && q['job'] === job).length * batch;

/** The nearest reachable stack of one of `kinds` (in order) with at least `batch` in it nobody else
 * is fetching, the store's before ground at a tie. */
function stackOf(
  ctx: SystemContext,
  p: EntityRow,
  job: string,
  kinds: readonly string[],
  batch: number,
): EntityRow | undefined {
  const { world, content } = ctx;
  const taken = busy(world, p, job);
  const from = spotOf(p);
  for (const kind of kinds) {
    let best: EntityRow | undefined;
    let far = Infinity;
    for (const i of itemsOf(world)) {
      if (i['kind'] !== kind || i['holder'] || (i['count'] as number) < batch || taken.has(i.id))
        continue;
      const at = spotOf(i);
      const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) * 2;
      const score = d + (inStore(world, at.x, at.y, at.z) ? 0 : 1);
      if (score < far && canReach(content, world.map, from, at)) [best, far] = [i, score];
    }
    if (best) return best;
  }
  return undefined;
}

/** A firewood in the store `p` can get to. */
function fuelOf(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const from = spotOf(p);
  return itemsOf(world).find((i) => {
    if (i['kind'] !== content.buildings.mill.bake.fuel || i['holder']) return false;
    const at = spotOf(i);
    return inStore(world, at.x, at.y, at.z) && canReach(content, world.map, from, at);
  });
}

const tileOf = (world: WorldState, r: EntityRow) =>
  (r['y'] as number) * world.map.width + (r['x'] as number);

/** A built piece of `kind` that `p` can stand beside. */
function builtPiece(ctx: SystemContext, p: EntityRow, test: (f: EntityRow) => boolean) {
  const { world, content } = ctx;
  const reach = reachFrom(content, world.map, spotOf(p));
  return furnitureOf(world).find(
    (f) =>
      f['state'] === 'built' &&
      f['z'] === 0 &&
      test(f) &&
      besideReachable(world, content, reach, tileOf(world, f)),
  );
}

/** Grinding: flour short, a turning mill or a quern with minutes left today, and grain. */
function pickGrind(ctx: SystemContext, p: EntityRow): Pick | undefined {
  const { world, content } = ctx;
  const def = content.buildings.mill;
  const want = wantOf(world, content, def.flour);
  const have = haveOf(world, content, def.flour);
  const m = millOf(world);
  const atMill = turning(world, m);
  const batch = atMill ? def.wheel.batch : def.quern.batch;
  if (have + coming(world, p, def.job, batch) >= want) return undefined;
  const piece = atMill
    ? builtPiece(ctx, p, (f) => f.id === m!['stones'])
    : quernToday(world) < def.quern.most
      ? builtPiece(ctx, p, (f) => f['kind'] === def.quern.kind)
      : undefined;
  if (!piece) return undefined;
  const stack = stackOf(ctx, p, def.job, def.from, def.quern.batch);
  const rate = atMill ? def.wheel.rate : def.quern.rate;
  const task = atMill ? 'mill' : 'quern';
  return (
    stack && { piece, stack, task, batch, minutes: Math.ceil((batch * 60) / rate), have, want }
  );
}

/** Baking: bread short, flour, a firewood, and the oven or the nearest hearth. */
function pickBake(ctx: SystemContext, p: EntityRow): Pick | undefined {
  const { world, content } = ctx;
  const def = content.buildings.mill;
  const bake = def.bake;
  const want = alive(world) * bake.perPerson;
  const have = countOf(world, bake.bread);
  const oven = builtPiece(ctx, p, (f) => f['kind'] === bake.oven.kind);
  const how = oven ? bake.oven : bake.hearth;
  if (have + coming(world, p, bake.job, how.batch) >= want) return undefined;
  const from = spotOf(p);
  const near = (r: EntityRow) =>
    Math.abs((r['x'] as number) - from.x) + Math.abs((r['y'] as number) - from.y);
  // The batch's own firewood heats the hearth, lit or not.
  const piece =
    oven ??
    [...furnitureOf(world)]
      .filter((f) => f['kind'] === HEARTH && f['state'] === 'built')
      .sort((a, b) => near(a) - near(b) || a.id - b.id)
      .find((f) => builtPiece(ctx, p, (g) => g.id === f.id));
  if (!piece || !fuelOf(ctx, p)) return undefined;
  const stack = stackOf(ctx, p, bake.job, [def.flour], bake.hearth.batch);
  const level = skillOf(world, p, skillName(content, bake.job));
  const minutes = Math.ceil((how.minutes * 2 * bake.skilled) / (bake.skilled + level));
  const task = oven ? 'oven' : 'hearth';
  return stack && { piece, stack, task, batch: how.batch, minutes, have, want };
}

const skillName = (content: EngineContent, job: string): string =>
  content.jobs.find((j) => j.id === job)?.skill ?? '';

const where = (ctx: SystemContext, pick: Pick): string =>
  pick.task === 'mill'
    ? 'at the mill'
    : pick.task === 'oven'
      ? 'at the oven by the mill'
      : pick.task === 'quern'
        ? 'at the quern'
        : placeOf(ctx.world, ctx.content, pick.piece).where;

/** Takes up grinding (`mill`) or baking (`bake`) if it is wanted and nobody free who puts the row
 * higher could. */
function takeUp(ctx: SystemContext, p: EntityRow, job: 'mill' | 'bake'): boolean {
  const { world, content } = ctx;
  const def = content.buildings.mill;
  const jobId = job === 'mill' ? def.job : def.bake.job;
  const pick = job === 'mill' ? pickGrind : pickBake;
  if (!able(content, p, jobId) || outranked(ctx, p, jobId, (q) => !!pick(ctx, q))) return false;
  const got = pick(ctx, p);
  if (!got) return false;
  const lit = got.task === 'hearth' ? (fireOf(world, got.piece.id)?.['line'] as number) : 0;
  p['took'] = ctx.emit(job === 'mill' ? 'work.tookUpMilling' : 'work.tookUpBaking', {
    causes: [
      job === 'mill' ? (got.piece['made'] as number) : lit || (got.piece['made'] as number),
      priorityLine(world, p.id, jobId),
    ].filter((l): l is number => !!l),
    actors: [p.id],
    data: { name: p['name'] as string, where: where(ctx, got), have: got.have, want: got.want },
  });
  Object.assign(p, {
    ...{ job, plan: got.piece.id, target: got.stack.id, work: got.minutes, task: got.task },
  });
  return millWork(ctx, p);
}

export const takeUpMilling = (ctx: SystemContext, p: EntityRow): boolean => takeUp(ctx, p, 'mill');
export const takeUpBaking = (ctx: SystemContext, p: EntityRow): boolean => takeUp(ctx, p, 'bake');

/** At the stack: take up to a batch, at least `least` (and, for baking, a firewood from the store). */
function gather(ctx: SystemContext, p: EntityRow, most: number, least: number): boolean {
  const { world } = ctx;
  const stack = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!stack || (stack['count'] as number) < least) return stop(p);
  const batch = Math.min(most, stack['count'] as number);
  if (!same(spotOf(stack), spotOf(p))) return walkTo(ctx, p, spotOf(stack)) || stop(p);
  if (p['job'] === 'bake') {
    const wood = fuelOf(ctx, p);
    if (!wood) return stop(p);
    takeFrom(world, wood, 1);
  }
  if (stack['count'] === batch) stack['holder'] = p.id;
  else {
    const made = stack['made'] as number;
    takeFrom(world, stack, batch);
    const kind = stack['kind'] as string;
    const id = layItem(world, { kind, count: batch, ...spotOf(p), made });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  p['target'] = -1;
  return true;
}

/** One minute of grinding or baking: false when it is done or cannot go on (the mill's water froze,
 * the quern's minutes for today are spent); what they carry then goes back. */
export function millWork(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.buildings.mill;
  const task = p['task'] as Pick['task'];
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  if (!piece) return stop(p);
  if (task === 'mill' && !turning(world, millOf(world))) return stop(p);
  if (task === 'quern' && quernToday(world) >= def.quern.most) return stop(p);
  const batch =
    task === 'mill'
      ? def.wheel.batch
      : task === 'quern'
        ? def.quern.batch
        : task === 'oven'
          ? def.bake.oven.batch
          : def.bake.hearth.batch;
  const load = loadOf(world, p.id);
  if (!load)
    return gather(ctx, p, batch, p['job'] === 'mill' ? def.quern.batch : def.bake.hearth.batch);
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  if (p['job'] === 'mill') noteGrind(world, task === 'mill' ? 'mill' : 'quern');
  else practise(ctx, p, skillName(content, def.bake.job), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const count = load['count'] as number;
  const what = content.items.find((i) => i.id === load['kind'])?.name ?? (load['kind'] as string);
  const at = where(ctx, { piece, task } as Pick);
  const line = ctx.emit(p['job'] === 'mill' ? 'food.ground' : 'food.baked', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, count, what, where: at },
  });
  layAround(ctx, p['job'] === 'mill' ? def.flour : def.bake.bread, count, here, line);
  takeFrom(world, load, count);
  return stop(p);
}
