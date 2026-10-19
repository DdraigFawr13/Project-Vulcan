// A person's round (P2.2): each minute they choose what to do from their needs and the hour. In
// order: eat when food is under its `seek` line (waking for it), sleep at night or when tired, on
// their own bedroll if they can get to it, take their leisure in the evening or when bored, and
// otherwise stroll near the camp. What they are doing is the `doing` field, which the needs
// system reads each hour; none of it is a ledger line until a need crosses its warning line.
import { clockAt, type EntityRow } from '../core/index.ts';
import { eatFrom, itemsAt, itemsOf } from '../goods/index.ts';
import { changeNeed, crossed, needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dayOf } from './day.ts';
import { carryBed, movesIn } from './home.ts';
import { working } from './jobs.ts';
import { tallyAdd } from './tally.ts';
import { walkTo, wander } from './walk.ts';

export const MIND_FIELDS = {
  /** `eat`, `sleep`, `moveBed` (home.ts), `work` (jobs.ts), `relax` or '' (idle). */
  doing: 'text',
  /** The tick before which they do not look for food again after finding none they can reach. */
  retry: 'int',
  /** While moving in: the surface tile (index + 1) they carry their bedroll to, else 0. */
  bedTo: 'int',
} as const;

const RETRY = 60;

const valueOf = (ctx: SystemContext, p: EntityRow, need: string): number =>
  (needOf(ctx.world, p.id, need)?.['value'] as number) ?? ctx.content.life.scale;

const seekOf = (ctx: SystemContext, need: string): number =>
  ctx.content.life.needs.find((n) => n.id === need)?.seek ?? 0;

const foodHere = (ctx: SystemContext, p: EntityRow): EntityRow | undefined =>
  itemsAt(ctx.world, p['x'] as number, p['y'] as number, p['z'] as number).find(
    (i) => ctx.content.life.eat[i['kind'] as string] !== undefined,
  );

/** Sets off to the nearest food lying on the ground; false when there is none to reach. */
function goEat(ctx: SystemContext, p: EntityRow): boolean {
  const { x, y, z } = { x: p['x'] as number, y: p['y'] as number, z: p['z'] as number };
  let best: EntityRow | undefined;
  let far = Infinity;
  for (const i of itemsOf(ctx.world)) {
    if (i['holder'] || ctx.content.life.eat[i['kind'] as string] === undefined) continue;
    const d =
      Math.max(Math.abs((i['x'] as number) - x), Math.abs((i['y'] as number) - y)) +
      Math.abs((i['z'] as number) - z) * 100;
    if (d < far) [best, far] = [i, d];
  }
  if (!best) return false;
  return walkTo(ctx, p, { x: best['x'] as number, y: best['y'] as number, z: best['z'] as number });
}

/** Eats one of the stack they stand on. */
function eat(ctx: SystemContext, p: EntityRow, item: EntityRow): void {
  const def = ctx.content.life.needs.find((n) => n.id === 'food');
  const row = needOf(ctx.world, p.id, 'food');
  if (!def || !row) return;
  const gives = ctx.content.life.eat[item['kind'] as string] ?? 0;
  eatFrom(ctx, item, p);
  tallyAdd(ctx, 'eaten', 1);
  changeNeed(ctx.content, row, gives);
  crossed(ctx, p, row, def);
}

/** Lies down: on their own laid-out bedroll when there is a way to it, else where they stand;
 * first carrying it into a house that has room (home.ts). */
function goToBed(ctx: SystemContext, p: EntityRow): void {
  if (movesIn(ctx, p)) return;
  p['doing'] = 'sleep';
  const bed = itemsOf(ctx.world).find((i) => i['owner'] === p.id && i['state'] === 'laid');
  const there = bed && bed['x'] === p['x'] && bed['y'] === p['y'] && bed['z'] === p['z'];
  if (bed && !there)
    walkTo(ctx, p, { x: bed['x'] as number, y: bed['y'] as number, z: bed['z'] as number });
  else p['path'] = [];
}

/** One minute of choosing, after the minute's steps. */
export function think(ctx: SystemContext, p: EntityRow, hour: number): void {
  const { world, content } = ctx;
  const life = content.life;
  const walking = (p['path'] as number[]).length > 0;
  if (p['doing'] === 'moveBed') {
    if (!walking) carryBed(ctx, p);
    return;
  }
  if (p['doing'] === 'eat') {
    if (walking) return;
    const item = foodHere(ctx, p);
    if (item) eat(ctx, p, item);
    p['doing'] = '';
  }
  if (valueOf(ctx, p, 'food') < seekOf(ctx, 'food') && world.tick >= (p['retry'] as number)) {
    if (goEat(ctx, p)) {
      p['doing'] = 'eat';
      return;
    }
    p['retry'] = world.tick + RETRY;
  }
  const day = dayOf(world, content);
  const night = hour >= day.sleepFrom || hour < day.workFrom;
  const rest = valueOf(ctx, p, 'rest');
  if (p['doing'] === 'sleep') {
    if (night || rest < life.sleep.wake) return;
    p['doing'] = '';
  }
  if (night || rest < seekOf(ctx, 'rest')) {
    goToBed(ctx, p);
    return;
  }
  const hours = hour >= day.workFrom && hour < day.workTo;
  if (working(ctx, p, hours)) {
    p['doing'] = 'work';
    return;
  }
  const leisure = hour >= day.workTo || valueOf(ctx, p, 'recreation') < seekOf(ctx, 'recreation');
  p['doing'] = leisure ? 'relax' : '';
  wander(ctx, p);
}

/** The hour of the day now, for everyone's choices this minute. */
export const hourNow = (ctx: SystemContext): number =>
  clockAt(ctx.world.tick, ctx.content.calendar).hour;
