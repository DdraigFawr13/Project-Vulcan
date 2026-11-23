// Work at a far shaft (6W review, V-227). Anvil's tin shaft, 70 tiles out, was taken up 34 times
// and never sunk: its sinker set out, turned home to eat after four hours on the way and never
// got there. So a miner whose shaft lies over `mine.pack` tiles from the green packs food for
// `mine.days` days and a bedroll, as a scout does, and eats and camps out there (people
// `afield.ts`). A plan held `mine.wait` days with nothing sunk goes to the next free miner, who
// is not made to wait for a better one; a plan not begun in a season says why, once a season.
// Nobody is sent (V-041): each takes it up of their own.
import { type EntityRow } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { haveOf } from '../goods/index.ts';
import { compass } from '../map/index.ts';
import { shaftsOf } from '../mine/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able as canDo, people } from '../band/index.ts';
import { isDown } from '../health/index.ts';
import { apart, packUp } from './camp.ts';
import type { Task } from './minetask.ts';
import { seasonDays } from './orewant.ts';
import { ladderOf } from './shaft.ts';

/** Who holds each shaft plan and since when: `h{id}` the holder, `t{id}` the tick they took it
 * up, `f{id}` the tick a miner first looked at it, `x{id}` the one last passed over and `y{id}`
 * when. */
const holdsOf = (ctx: SystemContext) => (ctx.world.systems['minefar'] ??= {});

/** The shaft a task works from, if any. */
const shaftOf = (ctx: SystemContext, t: Pick<Task, 'kind' | 'plan'>) =>
  ['sink', 'tunnel', 'mine'].includes(t.kind) && t.plan
    ? shaftsOf(ctx.world).find((s) => s.id === t.plan)
    : undefined;

/** How far the shaft lies from the green, in tiles. */
export function shaftFar(ctx: SystemContext, shaft: EntityRow): number {
  const g = greenOf(ctx.world);
  return apart(shaft['x'] as number, shaft['y'] as number, g.x, g.y);
}

/** A miner looking for work sees the plan: from now it waits. */
export function planSeen(ctx: SystemContext, shaft: EntityRow): void {
  if (!shaft['depth']) holdsOf(ctx)[`f${shaft.id}`] ??= ctx.world.tick;
}

/** A planned shaft not yet sunk a level that has waited `mine.wait` days: anyone free and able
 * may take it up, not only the one who puts Mining highest. */
export function longPlanned(ctx: SystemContext, plan: number): boolean {
  const shaft = shaftsOf(ctx.world).find((s) => s.id === plan);
  const since = holdsOf(ctx)[`f${plan}`];
  if (!shaft || shaft['depth'] || since === undefined) return false;
  return ctx.world.tick - since >= ctx.content.work.mine.wait * 1440;
}

/** Whether `p` was passed over for this plan in the last `mine.wait` days: they held it that
 * long and sank nothing. */
export function passedOver(ctx: SystemContext, plan: number, p: EntityRow): boolean {
  const holds = holdsOf(ctx);
  const wait = ctx.content.work.mine.wait * 1440;
  return holds[`x${plan}`] === p.id && ctx.world.tick - holds[`y${plan}`]! < wait;
}

/** On taking up a mining task: who holds its shaft's plan and since when, and a shaft far out
 * is gone to with a pack. */
export function takingUp(ctx: SystemContext, p: EntityRow, t: Task): void {
  const shaft = shaftOf(ctx, t);
  if (!shaft) return;
  const holds = holdsOf(ctx);
  if (t.kind === 'sink' && holds[`h${shaft.id}`] !== p.id) {
    holds[`h${shaft.id}`] = p.id;
    holds[`t${shaft.id}`] = ctx.world.tick;
  }
  if (!p['packed'] && shaftFar(ctx, shaft) > ctx.content.work.mine.pack)
    packUp(ctx, p, ctx.content.work.mine.days);
}

/** Each minute of sinking: a holder who has had the plan `mine.wait` days and sunk nothing gives
 * it up (true), and the next free miner may take it. */
export function heldTooLong(ctx: SystemContext, p: EntityRow, shaft: EntityRow): boolean {
  const holds = holdsOf(ctx);
  const id = shaft.id;
  if (shaft['depth'] || holds[`h${id}`] !== p.id) return false;
  if (ctx.world.tick - holds[`t${id}`]! < ctx.content.work.mine.wait * 1440) return false;
  [holds[`x${id}`], holds[`y${id}`]] = [p.id, ctx.world.tick];
  delete holds[`h${id}`];
  return true;
}

/** At each day's start: a plan not sunk a level a season after a miner first saw it says why,
 * once a season: too few logs for its ladder, too far for anyone free to have gone, or nobody
 * free able to mine. */
export function shaftWaitDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % 1440 !== 0) return;
  const holds = holdsOf(ctx);
  const season = seasonDays(ctx) * 1440;
  const mine = content.work.mine;
  for (const shaft of shaftsOf(world)) {
    const id = shaft.id;
    if (shaft['state'] !== 'planned' || shaft['depth']) continue;
    const last = holds[`s${id}`] ?? holds[`f${id}`];
    if (last === undefined || world.tick - last < season) continue;
    holds[`s${id}`] = world.tick;
    const far = shaftFar(ctx, shaft);
    const ladder = ladderOf(content);
    const logs = ladder ? haveOf(world, content, ladder.kind) : 0;
    const able = people(world).some(
      (q) => q['status'] === 'alive' && !isDown(world, q.id) && canDo(content, q, mine.job),
    );
    const why =
      ladder && logs < ladder.count
        ? mine.waits.ladder.replace('{logs}', String(ladder.count))
        : !able
          ? mine.waits.nobody
          : mine.waits.far.replace('{far}', String(far));
    const g = greenOf(world);
    ctx.emit('mine.shaftWaits', {
      causes: [shaft['line'] as number].filter((l) => l > 0),
      data: {
        metal: shaft['metal'] as string,
        far,
        dir: compass((shaft['x'] as number) - g.x, (shaft['y'] as number) - g.y),
        why,
      },
    });
  }
}
