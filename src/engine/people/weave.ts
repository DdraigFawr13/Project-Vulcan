// Weaving (Phase 5B Bundle 5, P5.5, V-041): the Weaver row of the Work sheet, the crafting skill.
// Once a loom stands, a free able person takes up spinning and weaving while the tailor is short
// of cloth: the everyday clothes wanted, plus two for each outer layer wanted that no leather or
// cured hides can make, more than the wool and linen in the colony. Wool from fleece first (it
// makes cloaks too), else linen from flax. They fetch the inputs, work beside the loom
// `minutes × 2 × skilled ÷ (skilled + level)` (practising), and lay the cloth for haulers.
import type { EntityRow } from '../core/index.ts';
import { furnitureOf, houseAt, roomName } from '../build/index.ts';
import { haveOf, shortOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { canStandBeside, goBeside, layAll, people, skillOf, spotOf } from './spots.ts';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
};

const nameOf = (ctx: SystemContext, kind: string): string =>
  ctx.content.items.find((i) => i.id === kind)?.name ?? kind;

/** The colony's built loom. */
export const loomOf = (ctx: SystemContext): EntityRow | undefined =>
  furnitureOf(ctx.world).find(
    (f) => f['kind'] === ctx.content.clothes.loom.piece && f['state'] === 'built',
  );

/** Cloth the tailor is short of (0 when none). */
export function clothShort(ctx: SystemContext): number {
  const { world, content } = ctx;
  const [everyday, outer] = content.clothes.slots.map((s) => shortOf(world, content, s.id));
  const leather = haveOf(world, content, 'leather');
  const cloaks = Math.max(0, outer! - Math.floor(leather / 2));
  const cloth = haveOf(world, content, 'wool') + haveOf(world, content, 'linen');
  return Math.max(0, everyday! + 2 * cloaks - cloth);
}

/** The recipe `p` could weave now: the first whose inputs they can reach. */
function choose(ctx: SystemContext, p: EntityRow) {
  if (clothShort(ctx) <= 0) return undefined;
  return ctx.content.clothes.weave.recipes.find((r) =>
    r.from.every((i) => reachableOf(ctx, p, i.kind) >= i.count),
  );
}

/** Where a piece stands, in words: "in the hall", "in Caoimhe's home". */
export function whereOf(ctx: SystemContext, piece: EntityRow): string {
  const h = houseAt(ctx.world, piece['x'] as number, piece['y'] as number);
  if (!h) return '';
  const room = roomName(ctx.world, ctx.content, h);
  return /^[A-Z]/.test(room) ? `in ${room}` : `in the ${room}`;
}

/** Takes up weaving when the loom stands, cloth is short and the inputs can be reached. */
export function takeUpWeaving(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.clothes.weave;
  const loom = loomOf(ctx);
  if (!loom) return false;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (people(world).some((q) => q.id !== p.id && q['job'] === 'weave')) return false;
  if (outranked(ctx, p, def.job, (q) => !!choose(ctx, q))) return false;
  const r = choose(ctx, p);
  if (!r || !canStandBeside(ctx, p, loom['x'] as number, loom['y'] as number)) return false;
  const stock = world.entities['stock']?.find((s) => s['good'] === content.clothes.good);
  p['took'] = ctx.emit('work.tookUpWeaving', {
    causes: [
      loom['line'] as number,
      stock?.['line'] as number,
      priorityLine(world, p.id, def.job),
    ].filter((l): l is number => !!l),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: nameOf(ctx, r.makes),
      from: nameOf(ctx, r.from[0]!.kind),
      why: `the tailor is short of cloth`,
    },
  });
  const level = skillOf(world, p, content.jobs.find((j) => j.id === def.job)?.skill ?? '');
  Object.assign(p, {
    ...{ job: 'weave', plan: loom.id, target: -1, make: r.makes },
    work: Math.ceil((r.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return weaving(ctx, p);
}

/** One minute of weaving; false when it is done or cannot be done. */
export function weaving(ctx: SystemContext, p: EntityRow): boolean {
  const { content } = ctx;
  const loom = loomOf(ctx);
  const r = content.clothes.weave.recipes.find((x) => x.makes === p['make']);
  if (!loom || loom.id !== p['plan'] || !r) return stop(p);
  for (const input of r.from) {
    const got = fetchKind(ctx, p, input.kind, input.count);
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
  }
  const [x, y] = [loom['x'] as number, loom['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) <= 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  const skill = content.jobs.find((j) => j.id === content.clothes.weave.job)?.skill ?? '';
  practise(ctx, p, skill, p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  for (const input of r.from) useHeld(ctx, p, input.kind, input.count);
  const line = ctx.emit('loom.wove', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      count: r.out,
      what: nameOf(ctx, r.makes),
      where: whereOf(ctx, loom),
    },
  });
  layAll(ctx, r.makes, r.out, here, line);
  stop(p);
  return true;
}
