// The lime burner (6B Bundle 3 part 2, P6.11, V-041): the Lime burning row of the Priorities
// sheet, crafting's skill. Nobody is told to burn lime. While a house's stone walls want lime
// mortar or its clay walls want limewash (build/stages.ts) beyond the lime the colony has, a free
// able person takes it up: burns limestone with firewood beside the kiln once both are to hand,
// else breaks a boulder by limestone rock. With no kiln, one is planned (keep/kiln.ts).
import type { EngineContent, EntityRow } from '../core/index.ts';
import { bouldersBy, kilnOf, limeWanted } from '../build/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, canStandBeside, declineIfUnable, fetchKind, goBeside } from '../band/index.ts';
import { layAround, outranked } from '../band/index.ts';
import {
  people,
  practise,
  priorityLine,
  reachableOf,
  skillOf,
  spotOf,
  useHeld,
} from '../band/index.ts';
import { breakBoulder, stopWork } from './quarrying.ts';

const JOB = 'limeburn';
const def = (content: EngineContent) => content.buildings.masonry.lime;
const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === def(content).job)?.skill ?? '';

const minutesFor = (ctx: SystemContext, p: EntityRow, minutes: number): number => {
  const k = def(ctx.content).skilled;
  return Math.max(
    1,
    Math.ceil((minutes * 2 * k) / (k + skillOf(ctx.world, p, skillName(ctx.content)))),
  );
};

/** What `p` would do: burn at the kiln, else break a boulder no other lime burner is at. */
function choose(
  ctx: SystemContext,
  p: EntityRow,
): { task: 'burn' | 'break'; plan: number } | undefined {
  const { world, content } = ctx;
  const d = def(content);
  if (limeWanted(world, content) <= 0) return undefined;
  // One lime burner at a time: the kiln takes one burning.
  if (people(world).some((q) => q.id !== p.id && q['job'] === JOB)) return undefined;
  const kiln = kilnOf(world);
  const stone = reachableOf(ctx, p, 'limestone') >= d.burn.limestone;
  if (kiln && stone && reachableOf(ctx, p, 'firewood') >= d.burn.fuel)
    return { task: 'burn', plan: kiln.id };
  if (stone) return undefined;
  const w = world.map.width;
  const tile = bouldersBy(world, content, d.rock, d.near).find((i) =>
    canStandBeside(ctx, p, i % w, Math.floor(i / w)),
  );
  return tile === undefined ? undefined : { task: 'break', plan: tile };
}

/** Takes up lime burning if lime is wanted and nobody free who puts it higher could. */
export function takeUpLime(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (limeWanted(world, content) <= 0) return false;
  if (!able(content, p, JOB)) {
    declineIfUnable(ctx, p, JOB);
    return false;
  }
  if (outranked(ctx, p, JOB, (q) => choose(ctx, q) !== undefined)) return false;
  const pick = choose(ctx, p);
  if (!pick) return false;
  p['took'] = ctx.emit('work.tookUpLime', {
    causes: [priorityLine(world, p.id, JOB) ?? 0].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      why:
        pick.task === 'burn'
          ? 'the walls want lime'
          : 'the walls want lime, and no limestone is broken',
    },
  });
  Object.assign(p, { job: JOB, plan: pick.plan, make: pick.task, target: -1, work: 0 });
  return limeBurning(ctx, p);
}

/** Limestone and firewood burned beside the kiln into lime laid at their feet. */
function burn(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const b = def(content).burn;
  const kiln = kilnOf(world);
  if (!kiln || kiln.id !== p['plan']) return stopWork(p);
  for (const [kind, n] of [
    ['limestone', b.limestone],
    ['firewood', b.fuel],
  ] as const) {
    const got = fetchKind(ctx, p, kind, n);
    if (got === 'none') return stopWork(p);
    if (got === 'walking') return true;
  }
  const [x, y] = [kiln['x'] as number, kiln['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stopWork(p);
  if (!(p['work'] as number)) p['work'] = minutesFor(ctx, p, b.minutes);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  useHeld(ctx, p, 'limestone', b.limestone);
  useHeld(ctx, p, 'firewood', b.fuel);
  const line = ctx.emit('lime.burned', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, count: b.lime },
  });
  layAround(ctx, 'lime', b.lime, spotOf(p), line);
  return stopWork(p);
}

/** One minute of lime burning; false when done or it cannot go on. */
export function limeBurning(ctx: SystemContext, p: EntityRow): boolean {
  const { content } = ctx;
  const d = def(content);
  if (p['make'] === 'burn') return burn(ctx, p);
  return breakBoulder(ctx, p, {
    skill: skillName(content),
    yields: { limestone: d.break.limestone, stone: d.break.stone },
    minutes: minutesFor(ctx, p, d.break.minutes),
    event: 'lime.broke',
  });
}
