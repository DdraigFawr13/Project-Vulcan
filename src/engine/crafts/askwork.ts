// Working an ask (6C Slice 3, V-225): a taken-up ask is a row of work at the colony's priority for
// it (people jobs.ts puts it among each person's kinds of work at that level). A free colonist who
// will work it carries what fits to the tithe barn (band askhaul.ts); a tool nobody has made yet
// is made by whoever free is able to smith, the most skilled first, at the forge (smith.ts).
// Nobody is picked (V-041).
import type { EntityRow } from '../core/index.ts';
import { fitsAsk, itemsOf, takenAsks } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, canStandBeside, people, reachableOf, readyFor, skillOf } from '../band/index.ts';
import { takeUpAskHaul } from '../band/index.ts';
import { forgeOf, jobOf, makeable, smithing } from './smith.ts';
import { willWork } from './askmade.ts';

/** The best (lowest) priority among taken-up asks still wanting something, or undefined. */
export const askLevel = (ctx: SystemContext): number | undefined =>
  takenAsks(ctx.world)[0]?.['level'] as number | undefined;

const freeNow = (ctx: SystemContext, q: EntityRow): boolean =>
  q['status'] === 'alive' &&
  q['job'] === '' &&
  !['sleep', 'eat', 'hurt'].includes(q['doing'] as string) &&
  ctx.world.tick >= (q['next'] as number);

/** Whether someone else free now, able to smith and willing, is more skilled at it than `p`. */
function moreSkilled(ctx: SystemContext, p: EntityRow, a: EntityRow): boolean {
  const { world, content } = ctx;
  const skill = jobOf(ctx).skill ?? '';
  const mine = skillOf(world, p, skill);
  return people(world).some(
    (q) =>
      q.id !== p.id &&
      freeNow(ctx, q) &&
      able(content, q, content.tools.job) &&
      willWork(ctx, q, a) &&
      skillOf(world, q, skill) > mine,
  );
}

/** Whether ask `a`'s tool must still be made: nothing that fits lies free, nobody is carrying or
 * making one for it, and the smith has not yet had `count` + 1 tries (a piece short of the
 * quality asked lies with the cart; the ask then goes late). */
function toMake(ctx: SystemContext, a: EntityRow): boolean {
  const { world, content } = ctx;
  if (((a['made'] as number) || 0) > (a['count'] as number)) return false;
  if ((a['going'] as number[]).length || people(world).some((q) => q['ask'] === a.id)) return false;
  return !itemsOf(world).some(
    (i) => !i['holder'] && !i['state'] && (i['x'] as number) >= 0 && fitsAsk(content, a, i),
  );
}

/** Takes up making ask `a`'s tool at the forge, if `p` can and nobody more skilled is free. */
function takeUpAskSmith(ctx: SystemContext, p: EntityRow, a: EntityRow): boolean {
  const { world, content } = ctx;
  const t = content.tools;
  const forge = forgeOf(ctx);
  const k = t.kinds.find((x) => x.id === a['tool']);
  const material = k && makeable(ctx, k.id);
  if (!forge || !k || !material || !able(content, p, t.job) || !toMake(ctx, a)) return false;
  if (people(world).some((q) => q.id !== p.id && q['job'] === t.job)) return false;
  const m = t.materials.find((x) => x.id === material)!;
  if (reachableOf(ctx, p, m.ingot!) < k.ingots || reachableOf(ctx, p, t.charcoal) < k.charcoal)
    return false;
  if (moreSkilled(ctx, p, a)) return false;
  if (!canStandBeside(ctx, p, forge['x'] as number, forge['y'] as number)) return false;
  const tool = readyFor(ctx, p, t.job);
  if (tool !== 'ok') return tool === 'knap';
  p['took'] = ctx.emit('ask.tookUp', {
    causes: [a['line'] as number, a['answer'] as number, forge['made'] as number].filter(
      (l) => l > 0,
    ),
    actors: [p.id],
    data: {
      ...{
        name: p['name'] as string,
        work: `${/^[aeiou]/.test(m.name) ? 'an' : 'a'} ${m.name} ${k.name}`,
      },
      ...{ asker: a['asker'] as string, what: a['what'] as string },
    },
  });
  Object.assign(p, { job: t.job, plan: 0, making: `${k.id}:${m.id}`, target: -1, work: -1 });
  p['ask'] = a.id;
  return smithing(ctx, p);
}

/** A village's ask is its own people's first: whether one from there, other than `p`, is free. */
const ownFirst = (ctx: SystemContext, p: EntityRow, a: EntityRow): boolean =>
  a['source'] === 'neighbour' &&
  p['home'] !== a['of'] &&
  people(ctx.world).some((q) => q.id !== p.id && q['home'] === a['of'] && freeNow(ctx, q));

/** The `ask` row of the job table: the taken-up asks in priority order, carrying what fits
 * first, else making it. */
export function takeUpAsk(ctx: SystemContext, p: EntityRow): boolean {
  for (const a of takenAsks(ctx.world)) {
    if (!willWork(ctx, p, a) || ownFirst(ctx, p, a)) continue;
    if (takeUpAskHaul(ctx, p, a)) return true;
    if (a['tool'] && takeUpAskSmith(ctx, p, a)) return true;
  }
  return false;
}
