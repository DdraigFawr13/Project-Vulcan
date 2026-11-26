// The valley's charter (6C Slice 7 part 4, V-236, V-242): the ladder's `charter` step, at a visit
// with favour at its `above`, `charter.least` or more living and more than `charter.years` years
// settled, once a run. The lord names the valley in the founders' tongue, as the world names its
// places (region `placeName`, a `lord` stream draw), and everyone living keeps `charter.memory`.
// The name is the lord row's (`charter`, `chartered`): the top bar, recaps and Region map show it,
// and the road carries it (band road.ts). The tithe stays.
import { yearNow, type EntityRow } from '../core/index.ts';
import { foundersOf } from '../band/index.ts';
import { alive, people } from '../entity/index.ts';
import { addMemories } from '../needs/index.ts';
import { placeName } from '../region/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lordName, lordRow, pronounsOf } from './tables.ts';

/** The valley's chartered name, the line it was granted on and when, once it has one. */
export function charterOf(world: {
  entities: Record<string, EntityRow[]>;
}): { name: string; line: number; at: number } | undefined {
  const lord = world.entities['lord']?.[0];
  const name = lord?.['charter'] as string | undefined;
  if (!lord || !name) return undefined;
  return { name, line: lord['chartered'] as number, at: lord['charterAt'] as number };
}

/** Whether the valley is big and old enough for its charter. */
export const charterDue = (ctx: SystemContext): boolean =>
  alive(ctx.world).length >= ctx.content.lord.charter.least &&
  yearNow(ctx.world, ctx.content) > ctx.content.lord.charter.years;

/** The lord grants the charter at the visit of `cause`: a name, one line, a memory for all. */
export function grantCharter(ctx: SystemContext, cause: number, favour: number): number {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const culture = foundersOf(content, people(world));
  const name = culture ? placeName(ctx.rng(), culture) : (lord['home'] as string);
  const living = alive(world);
  const heard = living.length;
  const line = ctx.emit('lord.charter', {
    causes: [cause],
    data: {
      ...{ lord: lordName(lord), his: pronounsOf(lord).his, reeve: lord['reeve'] as string },
      ...{ title: (lord['title'] as string).toLowerCase(), name, favour },
      heard: `${heard === 1 ? 'One' : String(heard)} of the valley`,
    },
  });
  Object.assign(lord, { charter: name, chartered: line, charterAt: world.tick });
  addMemories(
    ctx,
    living.map((p) => p.id),
    content.lord.charter.memory,
    line,
  );
  return line;
}
