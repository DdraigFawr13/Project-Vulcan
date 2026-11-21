// The mason (6B Bundle 3 part 2, P6.11, V-041): the Masonry row of the Priorities sheet,
// stoneworking's skill. Nobody is told what to build. While a house's stage wants slate, stone
// walls or limewash (build/stages.ts), a free able person takes it up: lays slate from beside the
// door once the roof's slate is to hand, else splits a boulder by slate rock; sets the next wall in
// dressed stone and mortar once both are to hand, else dresses stone; limewashes the clay walls
// from the door once the lime is to hand. A stage nothing can be done for says once what it lacks.
import type { EngineContent, EntityRow } from '../core/index.ts';
import { layItem } from '../goods/index.ts';
import {
  bouldersBy,
  housesAt,
  mainOf,
  partOf,
  plansOf,
  roofName,
  sayStageWaits,
  slateFor,
  wallsOf,
} from '../build/index.ts';
import { setBuilt } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, canStandBeside, declineIfUnable, fetchKind } from '../band/index.ts';
import { outranked, people } from '../band/index.ts';
import { practise, priorityLine, reachableOf, skillOf, spotOf } from '../band/index.ts';
import { neededKind, readyFor, scaled, useHeld, worked as toolWorked } from '../band/index.ts';
import { breakBoulder, stopWork } from './quarrying.ts';
import { goBeside as goAround, standsFor } from './build.ts';

const JOB = 'mason';
type Task = 'slate' | 'split' | 'wall' | 'dress' | 'wash';
interface Pick {
  task: Task;
  house: EntityRow;
  plan: number;
}

const def = (content: EngineContent) => content.buildings.masonry;
const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === def(content).mason.job)?.skill ?? '';

/** Minutes of masonry at `p`'s stoneworking level. */
const minutesFor = (ctx: SystemContext, p: EntityRow, minutes: number): number => {
  const k = def(ctx.content).mason.skilled;
  return Math.max(
    1,
    Math.ceil((minutes * 2 * k) / (k + skillOf(ctx.world, p, skillName(ctx.content)))),
  );
};

/** What other masons are on: `task:plan`. */
const onIt = (ctx: SystemContext, p: EntityRow): Set<string> =>
  new Set(
    people(ctx.world)
      .filter((q) => q.id !== p.id && q['job'] === JOB)
      .map((q) => `${q['make'] as string}:${q['plan'] as number}`),
  );

/** The slate stage of row `h`: lay it, else split a boulder, else say what it lacks. */
function slatePick(
  ctx: SystemContext,
  p: EntityRow,
  h: EntityRow,
  on: Set<string>,
): Pick | undefined {
  const { world, content } = ctx;
  if (on.has(`slate:${h.id}`)) return undefined;
  if (reachableOf(ctx, p, 'slate') >= slateFor(content, h))
    return { task: 'slate', house: h, plan: h.id };
  const s = def(content).mason.split;
  const w = world.map.width;
  const tile = bouldersBy(world, content, s.rock, s.near).find(
    (i) => !on.has(`split:${i}`) && canStandBeside(ctx, p, i % w, Math.floor(i / w)),
  );
  sayStageWaits(
    ctx,
    h,
    tile === undefined ? 'no slate can be split nearby' : 'no mason has split any slate yet',
  );
  return tile === undefined ? undefined : { task: 'split', house: h, plan: tile };
}

/** The stone stage of house `h`: set the next wall, else dress stone, else say what it lacks. */
function stonePick(
  ctx: SystemContext,
  p: EntityRow,
  h: EntityRow,
  on: Set<string>,
): Pick | undefined {
  const { content } = ctx;
  const st = def(content).stages.stone;
  const wall = wallsOf(ctx.world, h, st.from).find(
    (w) =>
      !on.has(`wall:${w.id}`) && standsFor(ctx, p, w['x'] as number, w['y'] as number).length > 0,
  );
  if (!wall) return undefined;
  const part = partOf(content, h['mortar'] === 'lime' ? st.lime : st.clay)!;
  const mortar = part.also!.material;
  const ashlar = reachableOf(ctx, p, part.material) >= part.cost;
  if (ashlar && reachableOf(ctx, p, mortar) >= part.also!.cost)
    return { task: 'wall', house: h, plan: wall.id };
  if (!ashlar && reachableOf(ctx, p, 'stone') >= def(content).mason.dress.stone)
    return { task: 'dress', house: h, plan: h.id };
  const lack = !ashlar
    ? 'no stone to dress'
    : mortar === 'lime'
      ? 'no lime has been burned yet'
      : 'no clay in the stores';
  sayStageWaits(ctx, h, lack);
  return undefined;
}

/** The wash stage of house `h`: wash it once the lime is to hand, else say it lacks lime. */
function washPick(
  ctx: SystemContext,
  p: EntityRow,
  h: EntityRow,
  on: Set<string>,
): Pick | undefined {
  const w = def(ctx.content).stages.wash;
  if (on.has(`wash:${h.id}`)) return undefined;
  const need = Math.ceil(wallsOf(ctx.world, h, [w.from]).length / w.per);
  if (need > 0 && reachableOf(ctx, p, 'lime') >= need)
    return { task: 'wash', house: h, plan: h.id };
  sayStageWaits(ctx, h, 'no lime has been burned yet');
  return undefined;
}

/** The work `p` would take: the oldest house's stage first, slate, then stone, then limewash. */
function choose(ctx: SystemContext, p: EntityRow): Pick | undefined {
  const on = onIt(ctx, p);
  const { world } = ctx;
  // One mason to a house: another house's stage is theirs to take.
  const free = (h: EntityRow) => !masonOn(ctx, p, h);
  const picks = [
    [slatePick, 'slate'],
    [stonePick, 'stone'],
    [washPick, 'wash'],
  ] as const;
  for (const [pickOf, stage] of picks)
    for (const h of housesAt(world, stage).filter(free)) {
      const pick = pickOf(ctx, p, h, on);
      if (pick) return pick;
    }
  return undefined;
}

/** Whether someone other than `p` is at masonry on house row `h`. */
const masonOn = (ctx: SystemContext, p: EntityRow, h: EntityRow): boolean =>
  people(ctx.world).some((q) => q.id !== p.id && q.id === h['mason'] && q['job'] === JOB);

const WHY: Record<Task, string> = {
  slate: 'the {size} wants a slate roof',
  split: 'the {size} wants slate, and none is split',
  wall: 'the {size} wants its walls in dressed stone',
  dress: 'the {size} wants dressed stone for its walls',
  wash: 'the {size} wants its clay walls limewashed',
};

/** Takes up masonry if a stage wants it and nobody free who puts Masonry higher could. */
export function takeUpMasonry(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!['slate', 'stone', 'wash'].some((s) => housesAt(world, s).length)) return false;
  if (!able(content, p, JOB)) {
    declineIfUnable(ctx, p, JOB);
    return false;
  }
  if (outranked(ctx, p, JOB, (q) => choose(ctx, q) !== undefined)) return false;
  const pick = choose(ctx, p);
  if (!pick) return false;
  const h = pick.house;
  // Dressing stone needs a chisel (V-195); rough walls go up without one.
  const tool = pick.task === 'dress' ? readyFor(ctx, p, 'dress') : 'ok';
  if (tool !== 'ok') {
    const chisel = neededKind(content, 'dress')?.name ?? '';
    if (tool === 'none') sayStageWaits(ctx, h, `no ${chisel} to dress stone`);
    return tool === 'knap';
  }
  // Back to the house they were on is the same work: no new line.
  if (h['mason'] !== p.id || !h['masonTook']) {
    h['masonTook'] = ctx.emit('work.tookUpMasonry', {
      causes: [h['stageLine'] as number, priorityLine(world, p.id, JOB) ?? 0].filter((l) => l > 0),
      actors: [p.id],
      data: {
        name: p['name'] as string,
        why: WHY[pick.task].replace('{size}', roofName(world, content, h)),
      },
    });
    h['mason'] = p.id;
  }
  Object.assign(p, {
    job: JOB,
    plan: pick.plan,
    make: pick.task,
    target: -1,
    work: 0,
    took: h['masonTook'],
  });
  return masonry(ctx, p);
}

/** Holds `n` of `kind`, then stands beside (x, y); false while still on the way. */
function ready(
  ctx: SystemContext,
  p: EntityRow,
  need: [string, number][],
  x: number,
  y: number,
): boolean | 'stop' {
  for (const [kind, n] of need) {
    const got = fetchKind(ctx, p, kind, n);
    if (got === 'none') return 'stop';
    if (got === 'walking') return false;
  }
  const here = spotOf(p);
  if (here.z === 0 && Math.max(Math.abs(here.x - x), Math.abs(here.y - y)) <= 1) return true;
  return goAround(ctx, p, x, y) ? false : 'stop';
}

/** One minute of the work in hand: counts down `minutes`; true once it is done. */
function worked(ctx: SystemContext, p: EntityRow, minutes: number): boolean {
  if (!(p['work'] as number)) p['work'] = minutesFor(ctx, p, minutes);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(ctx.content), p['took'] as number);
  return (p['work'] as number) <= 0;
}

const doorOf = (ctx: SystemContext, h: EntityRow) => {
  const w = ctx.world.map.width;
  const door = h['door'] as number;
  return { x: door % w, y: Math.floor(door / w) };
};

/** Slate on the roof, from beside the door. */
function laySlate(ctx: SystemContext, p: EntityRow, h: EntityRow): boolean {
  const { world, content } = ctx;
  const n = slateFor(content, h);
  const d = doorOf(ctx, h);
  const at = ready(ctx, p, [['slate', n]], d.x, d.y);
  if (at !== true) return at === false || stopWork(p);
  if (!worked(ctx, p, def(content).mason.slate.lay * n)) return true;
  useHeld(ctx, p, 'slate', n);
  const line = ctx.emit('mason.slated', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, size: roofName(world, content, h) },
  });
  Object.assign(h, {
    roof: 'slate',
    roofed: world.tick,
    roofLine: line,
    stage: '',
    mason: 0,
    masonTook: 0,
  });
  return stopWork(p);
}

/** Two stone dressed into one dressed stone, where they stand. */
function dress(ctx: SystemContext, p: EntityRow): boolean {
  const { content } = ctx;
  const d = def(content).mason.dress;
  const got = fetchKind(ctx, p, 'stone', d.stone);
  if (got !== 'done') return got === 'walking' || stopWork(p);
  if (!(p['work'] as number)) p['work'] = scaled(ctx, p, 'dress', minutesFor(ctx, p, d.minutes));
  toolWorked(ctx, p, 'dress');
  if (!worked(ctx, p, d.minutes)) return true;
  useHeld(ctx, p, 'stone', d.stone);
  const line = ctx.emit('mason.dressed', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, count: d.stone, made: 1 },
  });
  layItem(ctx.world, { kind: 'ashlar', count: 1, ...spotOf(p), made: line });
  return stopWork(p);
}

/** Sets a part in place of wall plan row `w`, keeping its row. */
function swapWall(ctx: SystemContext, w: EntityRow, to: string, cause: number): void {
  const { content } = ctx;
  const part = partOf(content, to)!;
  Object.assign(w, { part: to, have: part.cost, also: part.also?.cost ?? 0, done: cause });
  setBuilt(
    ctx,
    w['x'] as number,
    w['y'] as number,
    content.buildings.parts.indexOf(part) + 1,
    cause,
  );
}

/** The next wall set in dressed stone; the house says so once the last is. */
function setWall(ctx: SystemContext, p: EntityRow, h: EntityRow): boolean {
  const { world, content } = ctx;
  const st = def(content).stages.stone;
  const w = plansOf(world).find((r) => r.id === p['plan']);
  if (!w || !st.from.includes(w['part'] as string)) return stopWork(p);
  const to = h['mortar'] === 'lime' ? st.lime : st.clay;
  const part = partOf(content, to)!;
  const [x, y] = [w['x'] as number, w['y'] as number];
  const at = ready(
    ctx,
    p,
    [
      [part.material, part.cost],
      [part.also!.material, part.also!.cost],
    ],
    x,
    y,
  );
  if (at !== true) return at === false || stopWork(p);
  if (!worked(ctx, p, def(content).mason.wall.minutes)) return true;
  useHeld(ctx, p, part.material, part.cost);
  useHeld(ctx, p, part.also!.material, part.also!.cost);
  const mortar = h['mortar'] === 'lime' ? 'lime mortar' : 'clay';
  const line = ctx.emit('mason.walled', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, mortar, x, y },
  });
  swapWall(ctx, w, to, line);
  if (!wallsOf(world, h, st.from).length) {
    const done = ctx.emit('build.rebuilt', {
      causes: [line, h['stageLine'] as number].filter((l) => l > 0),
      data: { size: roofName(world, content, h), mortar },
    });
    Object.assign(h, { stage: '', wall: to, stageLine: done, mason: 0, masonTook: 0 });
  }
  return stopWork(p);
}

/** Limewash on every clay wall, from beside the door. */
function wash(ctx: SystemContext, p: EntityRow, h: EntityRow): boolean {
  const { world, content } = ctx;
  const w = def(content).stages.wash;
  const walls = wallsOf(world, h, [w.from]);
  const n = Math.ceil(walls.length / w.per);
  if (!n) return stopWork(p);
  const d = doorOf(ctx, h);
  const at = ready(ctx, p, [['lime', n]], d.x, d.y);
  if (at !== true) return at === false || stopWork(p);
  if (!worked(ctx, p, w.minutes * walls.length)) return true;
  useHeld(ctx, p, 'lime', n);
  const line = ctx.emit('mason.washed', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, size: roofName(world, content, h) },
  });
  for (const r of walls) swapWall(ctx, r, w.to, line);
  Object.assign(h, { stage: '', stageLine: line, mason: 0, masonTook: 0 });
  return stopWork(p);
}

/** One minute of masonry; false when done or it cannot go on. */
export function masonry(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const task = p['make'] as Task;
  const s = def(content).mason.split;
  if (task === 'split')
    return breakBoulder(ctx, p, {
      skill: skillName(content),
      yields: { slate: s.slate, stone: s.stone },
      minutes: minutesFor(ctx, p, s.minutes),
      event: 'mason.split',
    });
  if (task === 'dress') return dress(ctx, p);
  const row = (world.entities['house'] ?? []).find((h) => h.id === p['plan']);
  const wallRow = task === 'wall' ? plansOf(world).find((r) => r.id === p['plan']) : undefined;
  const house =
    row ?? (wallRow && (world.entities['house'] ?? []).find((h) => h.id === wallRow['house']));
  if (!house) return stopWork(p);
  const h = task === 'slate' ? house : mainOf(world, house);
  if (h['stage'] !== (task === 'slate' ? 'slate' : task === 'wash' ? 'wash' : 'stone'))
    return stopWork(p);
  if (task === 'slate') return laySlate(ctx, p, h);
  if (task === 'wall') return setWall(ctx, p, h);
  return wash(ctx, p, h);
}
