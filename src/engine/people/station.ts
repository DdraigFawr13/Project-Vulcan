// Building the smelter and the smokehouse (Phase 4 Bundle 3, 5B Bundle 3, V-041): the colony plans
// them (build/metalsite.ts, keep/house.ts); builders make them, so it is a row of the Work sheet's
// Building kind. A free person able to build takes up a planned one if stone for it can be had,
// fetches the stone, lays it, and works there its `minutes` (shorter with building skill, which
// they practise). One line when taken up and one when built.
import type { EngineContent, EntityRow } from '../core/index.ts';
import { stationsOf } from '../build/index.ts';
import { loadOf, takeFrom } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stackOf } from './build.ts';
import { fetchWood } from './carpentry.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { canStandBeside, goBeside, people, skillOf, spotOf } from './spots.ts';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1 });
  return false;
};

const skillName = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.buildings.job)?.skill ?? '';

/** What building a kind of station takes: the stone, the minutes and the line said when built. */
interface Def {
  kind: string;
  cost: number;
  material: string;
  minutes: number;
  skilled: number;
  built: string;
}

const defsOf = (content: EngineContent): Def[] => [
  { kind: 'smelter', ...content.metal.smelter, built: 'metal.smelterBuilt' },
  { kind: 'smokehouse', ...content.work.cure.house, built: 'cure.houseBuilt' },
  { kind: 'kiln', ...content.work.potter.kiln, built: 'potter.kilnBuilt' },
];

/** The first planned station nobody is on that `p` has stone for or can reach some. */
function choose(ctx: SystemContext, p: EntityRow): { s: EntityRow; def: Def } | undefined {
  const { world, content } = ctx;
  for (const def of defsOf(content))
    for (const s of stationsOf(world).filter((r) => r['kind'] === def.kind)) {
      if (s['state'] !== 'plan') continue;
      if (people(world).some((q) => q.id !== p.id && q['job'] === 'station' && q['plan'] === s.id))
        continue;
      if (!canStandBeside(ctx, p, s['x'] as number, s['y'] as number)) continue;
      if ((s['have'] as number) >= def.cost || stackOf(ctx, p, def.material)) return { s, def };
    }
  return undefined;
}

/** Takes up building the smelter if one is planned and nobody free who puts Building higher could. */
export function takeUpStation(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const job = content.buildings.job;
  if (!able(content, p, job) || outranked(ctx, p, job, (q) => choose(ctx, q) !== undefined))
    return false;
  const got = choose(ctx, p);
  if (!got) return false;
  const { s, def } = got;
  p['took'] = ctx.emit('work.tookUpStation', {
    causes: [s['line'] as number, priorityLine(world, p.id, job)].filter((l): l is number => !!l),
    actors: [p.id],
    data: { name: p['name'] as string, what: def.kind, where: `at ${s['x']}, ${s['y']}` },
  });
  Object.assign(p, { job: 'station', plan: s.id, target: -1 });
  return stationing(ctx, p);
}

/** One minute on the station: fetch stone, lay it, work; false when done, gone or out of reach. */
export function stationing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const s = stationsOf(world).find((r) => r.id === p['plan']);
  const def = s && defsOf(content).find((d) => d.kind === s['kind']);
  if (!s || !def || s['state'] !== 'plan') return stop(p);
  const [x, y] = [s['x'] as number, s['y'] as number];
  const here = spotOf(p);
  const beside = here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1;
  const need = def.cost - (s['have'] as number);
  const load = loadOf(world, p.id);
  if (load && (need <= 0 || load['kind'] !== def.material)) return stop(p);
  if (load) {
    if (!beside) return goBeside(ctx, p, x, y) || stop(p);
    const used = Math.min(need, load['count'] as number);
    s['have'] = (s['have'] as number) + used;
    takeFrom(world, load, used);
    return true;
  }
  if (need > 0) return fetchWood(ctx, p, need, def.material);
  if (!beside) return goBeside(ctx, p, x, y) || stop(p);
  const level = skillOf(world, p, skillName(ctx));
  if ((s['work'] as number) < 0)
    s['work'] = Math.max(1, Math.ceil((def.minutes * def.skilled) / (def.skilled + level)));
  s['work'] = (s['work'] as number) - 1;
  practise(ctx, p, skillName(ctx), p['took'] as number);
  if ((s['work'] as number) > 0) return true;
  s['state'] = 'built';
  s['made'] = ctx.emit(def.built, {
    causes: [p['took'] as number, s['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, where: `at ${x}, ${y}` },
  });
  stop(p);
  return true;
}
