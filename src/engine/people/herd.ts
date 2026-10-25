// Herding (Phase 5 Bundle 3, V-041): nobody is ordered. A free person able for `herd` takes the
// work up by their own priority order, like farming; the Herding row on the Work sheet is the only
// lever. Two jobs are the day's own and come before anything else the herder does: shutting the
// flock in before dusk and letting it out after dawn (`duty`), even outside work hours. The rest
// (butchering, shearing, hay, taming: herdtask.ts) is taken up in work hours. The rules and the
// lines are src/engine/flock; this is who walks where and for how many minutes.
import type { EntityRow, WorldState } from '../core/index.ts';
import { foldTiles } from '../build/index.ts';
import {
  addToRick,
  butcher,
  flocksOf,
  foldFlock,
  headOf,
  keptOf,
  mowable,
  mowTile,
  noteLeftOut,
  openFlock,
  readySwaths,
  shear,
  shearable,
  takeHay,
} from '../flock/index.ts';
import { loadOf } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { flockById, pickTask, skillName, strokeMinutes, tameStep, type Pick } from './herdtask.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, levelOf, outranked } from './priority.ts';
import { canStandBeside, goBeside, people } from './spots.ts';
import { scaled } from './tools.ts';
import { watchMinute } from './watch.ts';

type Duty = 'fold' | 'unfold';

/** Work whose kind on the Work sheet is not its job name. */
const KIND: Readonly<Record<string, string>> = {
  hearth: 'build',
  station: 'build',
  bury: 'build',
  dress: 'heal',
};

const pastureOf = (world: WorldState, flock: EntityRow): EntityRow =>
  (world.entities['pasture'] ?? []).find((r) => r.id === flock['pasture'])!;

const tileAt = (world: WorldState, i: number) => ({
  x: i % world.map.width,
  y: Math.floor(i / world.map.width),
});

/** Ends the herding job. */
function stop(p: EntityRow): false {
  Object.assign(p, { job: '', task: '', plan: 0, target: -1, work: 0 });
  return false;
}

const near = (p: EntityRow, x: number, y: number): boolean =>
  Math.abs((p['x'] as number) - x) + Math.abs((p['y'] as number) - y) <= 1 && p['z'] === 0;

/** Which of the day's two jobs the flock needs now: fold from `fold.before` minutes ahead of
 * `night.from` until `night.to` + `fold.open`, else let out. */
function dutyOf(ctx: SystemContext, flock: EntityRow): Duty | undefined {
  const { world, content } = ctx;
  const { night } = content.wild.pack;
  const { before, open } = content.flock.fold;
  const now = world.tick % 1440;
  if (now >= night.from * 60 - before || now < night.to * 60 + open) {
    if (flock['folded'] || !headOf(world, flock)) return undefined;
    const fold = new Set(foldTiles(world.map.width, pastureOf(world, flock)));
    const w = world.map.width;
    const out = keptOf(world, flock).some(
      (a) => !fold.has((a['y'] as number) * w + (a['x'] as number)),
    );
    return out ? 'fold' : undefined;
  }
  return flock['folded'] ? 'unfold' : undefined;
}

const resting = (q: EntityRow): boolean =>
  ['sleep', 'eat', 'hurt', 'warm', 'moveBed'].includes(q['doing'] as string);

/** Where a person's current work stands on the Work sheet (a number to compare, 1 first), or
 * Infinity for work that is not on it. */
function rankOf(ctx: SystemContext, q: EntityRow): number {
  const job = q['job'] as string;
  const kind = KIND[job] ?? job;
  return ctx.content.work.priority.jobs.includes(kind)
    ? levelOf(ctx.world, ctx.content, q.id, kind)
    : Infinity;
}

/** Herders in order: those who put Herding higher first, ties in person order. */
function herdersByRank(ctx: SystemContext): EntityRow[] {
  const { world, content } = ctx;
  const job = content.flock.job;
  return people(world)
    .filter((q) => q['status'] === 'alive' && able(content, q, job))
    .sort((a, b) => levelOf(world, content, a.id, job) - levelOf(world, content, b.id, job));
}

/** Whether `q` is free for a duty: not eating, asleep, hurt or warming, not carrying a load or a
 * body, and not at work they rank above Herding. */
function freeFor(ctx: SystemContext, q: EntityRow): boolean {
  const { world, content } = ctx;
  return (
    !resting(q) &&
    !loadOf(world, q.id) &&
    q['job'] !== 'bury' &&
    rankOf(ctx, q) >= levelOf(world, content, q.id, content.flock.job)
  );
}

/** The free herder who puts Herding highest (ties in person order). */
const folderFor = (ctx: SystemContext): EntityRow | undefined =>
  herdersByRank(ctx).find((q) => freeFor(ctx, q));

/** Minutes since `duty`'s time began today: `night.from` less `fold.before`, or `night.to` plus
 * `fold.open`. */
function sinceDuty(ctx: SystemContext, duty: Duty): number {
  const { night } = ctx.content.wild.pack;
  const { before, open } = ctx.content.flock.fold;
  const start = duty === 'fold' ? night.from * 60 - before : night.to * 60 + open;
  return (ctx.world.tick % 1440) - start + (ctx.world.tick % 1440 < start ? 1440 : 0);
}

/** Takes `duty` on `flock` for `p` if they should: the best-placed free herder, or after
 * `fold.wait` minutes any free herder able for it; and only with a way to the fold's gate. */
function startDuty(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!able(content, p, content.flock.job)) return false;
  for (const flock of flocksOf(world)) {
    const held = people(world).some(
      (q) =>
        q['job'] === 'herd' &&
        q['plan'] === flock.id &&
        (q['task'] === 'fold' || q['task'] === 'unfold'),
    );
    const duty = !held && dutyOf(ctx, flock);
    if (!duty) continue;
    const late = sinceDuty(ctx, duty) >= content.flock.fold.wait;
    if (late ? !freeFor(ctx, p) : folderFor(ctx)?.id !== p.id) continue;
    const gate = tileAt(world, pastureOf(world, flock)['foldGate'] as number);
    if (!canStandBeside(ctx, p, gate.x, gate.y)) continue;
    p['path'] = [];
    Object.assign(p, { job: 'herd', task: duty, plan: flock.id, work: 0, took: flock['line'] });
    p['target'] = gate.y * world.map.width + gate.x;
    return true;
  }
  return false;
}

/** The first of the day's jobs or the work in hand, for the start of `working` (jobs.ts): the
 * duty comes before everything else a free herder does. */
export function herding(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  const onDuty = p['job'] === 'herd' && (p['task'] === 'fold' || p['task'] === 'unfold');
  if (!onDuty && !startDuty(ctx, p) && p['job'] !== 'herd') return false;
  return herdWork(ctx, p, hours);
}

/** Goes on to the next thing to do on this flock, else stops. */
function next(ctx: SystemContext, p: EntityRow, flock: EntityRow): boolean {
  const pick = pickTask(ctx, p, flock);
  if (!pick) return stop(p);
  Object.assign(p, { task: pick.task, target: pick.target, work: 0 });
  return true;
}

/** One minute of the herding work in hand. */
function herdWork(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  const { world } = ctx;
  const flock = flockById(world, p['plan'] as number);
  const task = p['task'] as string;
  if (!flock) return stop(p);
  const duty = task === 'fold' || task === 'unfold';
  if (!hours && !duty && !(task === 'hay' && (p['hay'] as number) > 0)) return stop(p);
  if ((p['path'] as number[]).length > 0) return true;
  if (duty) return dutyMinute(ctx, p, flock, task === 'fold');
  if (task === 'hay') return hayMinute(ctx, p, flock);
  // A sitting over, an animal taken in or no way to the herd: they look again later.
  if (task === 'tame') return tameStep(ctx, p, flock) || stop(p);
  return stroke(ctx, p, flock, task);
}

/** Walks to the fold's gate, works `fold.minutes`, shuts the flock in (or lets it out). */
function dutyMinute(ctx: SystemContext, p: EntityRow, flock: EntityRow, fold: boolean): boolean {
  const { world, content } = ctx;
  if (!!flock['folded'] === fold) return stop(p);
  const gate = tileAt(world, p['target'] as number);
  if (!near(p, gate.x, gate.y)) return goBeside(ctx, p, gate.x, gate.y) || stop(p);
  if (p['work'] === 0) p['work'] = scaled(ctx, p, 'herd', content.flock.fold.minutes);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  if (fold) foldFlock(ctx, flock, p.id);
  else openFlock(ctx, flock, p.id);
  stop(p);
  return true;
}

/** Carries cured hay from a swath to the rick, a load (`hay.carry`) at a time. */
function hayMinute(ctx: SystemContext, p: EntityRow, flock: EntityRow): boolean {
  const { world, content } = ctx;
  const carrying = p['hay'] as number;
  const spot = tileAt(
    world,
    carrying ? (pastureOf(world, flock)['rick'] as number) : (p['target'] as number),
  );
  if (!carrying && !readySwaths(world, content, flock).includes(p['target'] as number))
    return next(ctx, p, flock);
  if (!near(p, spot.x, spot.y)) return goBeside(ctx, p, spot.x, spot.y) || stop(p);
  if (carrying) {
    addToRick(ctx, flock, carrying);
    p['hay'] = 0;
  } else {
    p['hay'] = takeHay(world, flock, p['target'] as number, content.flock.hay.carry);
    p['target'] = -1;
    if (p['hay']) return true;
  }
  return next(ctx, p, flock);
}

/** Butchering, shearing or mowing: beside the animal or tile, the minutes, then the deed. */
function stroke(ctx: SystemContext, p: EntityRow, flock: EntityRow, task: string): boolean {
  const { world, content } = ctx;
  const target = p['target'] as number;
  const animal = keptOf(world, flock).find((a) => a.id === target);
  const valid =
    task === 'mow'
      ? mowable(world, content, flock).includes(target)
      : task === 'butcher'
        ? !!animal?.['cull']
        : !!animal && shearable(world, content, flock).includes(animal);
  if (!valid) return next(ctx, p, flock);
  const spot = animal
    ? { x: animal['x'] as number, y: animal['y'] as number }
    : tileAt(world, target);
  if (!near(p, spot.x, spot.y)) return goBeside(ctx, p, spot.x, spot.y) || stop(p);
  if (p['work'] === 0) {
    const minutes =
      task === 'mow'
        ? strokeMinutes(ctx, p, content.flock.hay.mow, skillName(content))
        : content.flock[task === 'butcher' ? 'cull' : 'shear'].minutes;
    p['work'] = scaled(ctx, p, 'herd', minutes);
  }
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  if (task === 'mow') mowTile(ctx, flock, target, p.id);
  else if (task === 'shear') shear(ctx, flock, animal!, p.id);
  else cullAnimal(ctx, p, flock, animal!);
  next(ctx, p, flock);
  return true;
}

/** Butchers a marked animal; whoever tamed it remembers (`memories.cull`). */
function cullAnimal(ctx: SystemContext, p: EntityRow, flock: EntityRow, animal: EntityRow): void {
  const tamer = animal['tamedBy'] as number;
  const line = butcher(ctx, flock, animal, p.id);
  const who = people(ctx.world).find((q) => q.id === tamer && q['status'] === 'alive');
  if (who) addMemory(ctx, who.id, ctx.content.flock.memories.cull, line);
}

/** Herding on the Work sheet: taken up when a flock has work and nobody free who puts it higher
 * could do it; declined once per change when not able (priority.ts). */
export function takeUpHerding(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const job = content.flock.job;
  if (!flocksOf(world).length) return false;
  if (!able(content, p, job)) {
    declineIfUnable(ctx, p, job);
    return false;
  }
  const most = content.jobs.find((j) => j.id === job)?.perWorkplace ?? Infinity;
  for (const flock of flocksOf(world)) {
    // At most `perWorkplace` (jobs.json) herders on a flock at once.
    const on = people(world).filter(
      (q) => q.id !== p.id && q['job'] === job && q['plan'] === flock.id,
    ).length;
    if (on >= most) continue;
    const pick: Pick | undefined = pickTask(ctx, p, flock);
    if (!pick) continue;
    if (outranked(ctx, p, job, (q) => pickTask(ctx, q, flock) !== undefined)) return false;
    Object.assign(p, {
      job: 'herd',
      task: pick.task,
      plan: flock.id,
      target: pick.target,
      work: 0,
      took: flock['line'],
    });
    return herdWork(ctx, p, true);
  }
  return false;
}

/** Once a minute, before anyone moves (system.ts): at `night.from` writes why a flock still out
 * was not shut in, once a night; and gives the herders `memories.taken` when the pack took one. */
export function herdWatch(ctx: SystemContext): void {
  const { world, content } = ctx;
  const flocks = flocksOf(world);
  if (!flocks.length) return;
  watchMinute(ctx);
  if (world.tick % 1440 === content.wild.pack.night.from * 60) leftOut(ctx);
  const seen = ctx.state['taken'] ?? 0;
  const fresh = flocks.filter((f) => (f['takenLine'] as number) > seen);
  if (!fresh.length) return;
  ctx.state['taken'] = Math.max(...fresh.map((f) => f['takenLine'] as number));
  const last = content.work.priority.words.length;
  for (const flock of fresh) {
    const tamers = new Set(keptOf(world, flock).map((a) => a['tamedBy'] as number));
    for (const q of people(world))
      if (
        q['status'] === 'alive' &&
        (levelOf(world, content, q.id, content.flock.job) < last || tamers.has(q.id))
      )
        addMemory(ctx, q.id, content.flock.memories.taken, flock['takenLine'] as number);
  }
}

/** The reason the folder (or the best-placed herder) did not shut `flock` in, in `flock.json` `why`'s words. */
function leftOut(ctx: SystemContext): void {
  const { world, content } = ctx;
  const best = herdersByRank(ctx)[0];
  for (const flock of flocksOf(world)) {
    if (flock['folded'] || !headOf(world, flock) || flock['outLine']) continue;
    // Whoever took the duty and is not done, else the best-placed herder.
    const who =
      people(world).find(
        (q) => q['job'] === 'herd' && q['task'] === 'fold' && q['plan'] === flock.id,
      ) ?? best;
    if (!who) noteLeftOut(ctx, flock, content.flock.why['none'] ?? '', 0);
    else noteLeftOut(ctx, flock, reasonOf(ctx, who), who.id);
  }
}

/** Why `q` was not at the fold: abed, warming, eating, on the way there, at other work (named
 * by its Work sheet kind), or free with no way to the gate. */
function reasonOf(ctx: SystemContext, q: EntityRow): string {
  const { content } = ctx;
  const doing = q['doing'] as string;
  const job = q['job'] as string;
  const key =
    doing === 'sleep' || doing === 'hurt'
      ? 'abed'
      : doing === 'warm'
        ? 'warming'
        : doing === 'eat'
          ? 'eating'
          : job === 'herd' && q['task'] === 'fold'
            ? 'toFold'
            : job === ''
              ? 'noWay'
              : 'busy';
  const name = content.jobs.find((j) => j.id === (KIND[job] ?? job))?.name.toLowerCase() ?? job;
  return (content.flock.why[key] ?? '')
    .replace('{who}', q['name'] as string)
    .replace('{work}', name);
}
