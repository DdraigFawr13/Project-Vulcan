// Hunting (P5.4a, V-041, V-110, V-122): nobody is told to hunt. While the Food plate is short, a
// free able person takes up hunting: the largest herd of game worth the hunt (never one at its
// last few, `spareCount`), nearest the town among equals, is walked towards and, within `near`
// tiles, stalked: every `every` minutes a kill chance by hunting skill and spear, else the herd
// bolts. Hares are snared where the stalking is hopeless, one an `every` minutes. A hunter who
// steps on fresh hoof prints follows them to that herd (`work.followedTracks`, once a hunt). If
// the pack has attacked within `tracks.packDays`, two who put Hunt higher go after it
// (`work.trackingPack`; fight or flee, flee.ts, does the rest when they come in sight).
// Taking up, tracks and each kill are ledger lines (the kill is wild's `wild.killed`).
import { streamFor, TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { greenOf, ringOf } from '../build/index.ts';
import { haveOf, stockOf, wantOf } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import {
  animalsOf,
  herdOf,
  huntable,
  killAnimal,
  membersOf,
  packOf,
  printsAt,
  scareHerd,
  speciesOf,
} from '../wild/index.ts';
import { practise } from './learn.ts';
import { able, levelOf, outranked, priorityLine } from './priority.ts';
import { people, skillOf, spotOf } from './spots.ts';
import { scaled, toolPercent, worked } from './tools.ts';
import { walkTo } from './walk.ts';

const reach = (a: Spot, b: Spot): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const DIRS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;

/** Ends a hunt: they look for other work. */
export function endHunt(p: EntityRow): false {
  Object.assign(p, { job: '', target: -1, work: 0, task: '', what: '' });
  return false;
}

const nearestOf = (animals: readonly EntityRow[], from: Spot): EntityRow | undefined =>
  [...animals].sort((a, b) => reach(spotOf(a), from) - reach(spotOf(b), from) || a.id - b.id)[0];

/** Hunting is wanted when food, with the meat others are walking to, is under its Food plate. */
function foodShort(
  ctx: SystemContext,
  p: EntityRow,
  full = false,
): { have: number; want: number } | undefined {
  const { world, content } = ctx;
  const good = content.items.find((i) => i.id === 'game')?.good ?? 'food';
  const want = wantOf(world, content, good);
  if (want <= 0) return undefined;
  const have = haveOf(world, content, good);
  let coming = 0;
  for (const q of people(world)) {
    if (q.id === p.id || q['job'] !== 'hunt' || q['task'] === 'pack') continue;
    const herd = herdOf(world, q['target'] as number);
    if (herd) coming += speciesOf(content, herd['species'] as string).meat || 1;
  }
  const line = full ? want : Math.floor((want * content.work.hunt.from) / 100);
  return have + coming < line ? { have, want } : undefined;
}

/** The herd `p` would hunt: the largest worth the hunt, nearest the green among equals; stalked
 * game before hares; one with an animal they can reach. */
function chooseHerd(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const snared = content.work.hunt.snare.species;
  const size = new Map<number, number>();
  for (const a of animalsOf(world))
    if (a['herd']) size.set(a['herd'] as number, (size.get(a['herd'] as number) ?? 0) + 1);
  const green = greenOf(world);
  const apart = (h: EntityRow): number =>
    reach({ x: h['x'] as number, y: h['y'] as number, z: 0 }, green);
  const all = huntable(world, content);
  const stalked = all.filter((h) => !snared.includes(h['species'] as string));
  const list = (stalked.length ? stalked : all).sort(
    (a, b) => size.get(b.id)! - size.get(a.id)! || apart(a) - apart(b) || a.id - b.id,
  );
  for (const h of list) {
    const near = nearestOf(membersOf(world, h.id), spotOf(p));
    if (near && canReach(content, world.map, spotOf(p), spotOf(near))) return h;
  }
  return undefined;
}

/** The days since the pack last attacked, if it has within the packDays. */
function attackedDays(ctx: SystemContext): number | undefined {
  const pack = packOf(ctx.world);
  if (!pack?.['attacked']) return undefined;
  const days = Math.floor((ctx.world.tick - (pack['attackedAt'] as number)) / TICKS_PER_DAY);
  return days <= ctx.content.wild.folk.tracks.packDays ? days : undefined;
}

/** Whether a fresh paw print lies within the ring and `tracks.ring` of the green. */
function freshPaws(ctx: SystemContext): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const green = greenOf(world);
  const r = ringOf(world, content) + content.wild.folk.tracks.ring;
  for (let y = Math.max(0, green.y - r); y <= Math.min(map.height - 1, green.y + r); y += 1)
    for (let x = Math.max(0, green.x - r); x <= Math.min(map.width - 1, green.x + r); x += 1) {
      const i = y * map.width + x;
      const print = map.printKind[i] ? printsAt(world, content, i) : undefined;
      if (print?.kind === 'paw' && print.ageHours < content.wild.folk.tracks.hours) return true;
    }
  return false;
}

/** The compass word of a print's direction. */
const dirWord = (ctx: SystemContext, dir: number): string => ctx.content.wild.folk.compass[dir]!;

/** Two who put Hunt higher take up the pack: the person, and a partner free and able. */
function takeUpPack(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.hunt;
  const days = attackedDays(ctx);
  const pack = packOf(world);
  const eager = (q: EntityRow): boolean =>
    able(content, q, def.job) && levelOf(world, content, q.id, def.job) < def.pack.level;
  if (days === undefined || !pack || !eager(p) || !freshPaws(ctx)) return false;
  const partner = people(world).find(
    (q) =>
      q.id !== p.id &&
      q['status'] === 'alive' &&
      q['job'] === '' &&
      !['sleep', 'eat', 'hurt'].includes(q['doing'] as string) &&
      world.tick >= (q['next'] as number) &&
      eager(q),
  );
  const prey = nearestOf(
    animalsOf(world).filter((a) => a['pack']),
    spotOf(p),
  );
  if (!partner || !prey || !walkTo(ctx, p, spotOf(prey))) return false;
  const green = greenOf(world);
  const line = ctx.emit('work.trackingPack', {
    causes: [pack['attacked'] as number],
    actors: [p.id, partner.id],
    data: {
      name: p['name'] as string,
      other: partner['name'] as string,
      days,
      dir: dirWord(ctx, dirOfPoint(green, spotOf(prey))),
    },
  });
  for (const q of [p, partner]) {
    Object.assign(q, { job: 'hunt', task: 'pack', target: pack.id, what: '', work: 0, took: line });
    if (q !== p) walkTo(ctx, q, spotOf(prey));
  }
  return true;
}

/** The compass index (0 north to 7 north-west) of the way from `from` to `to`. */
function dirOfPoint(from: Spot, to: Spot): number {
  const [dx, dy] = [Math.sign(to.x - from.x), Math.sign(to.y - from.y)];
  const k = DIRS.findIndex(([x, y]) => x === dx && y === dy);
  return k < 0 ? 0 : k;
}

/** Takes up hunting when food is short (or the pack is to be tracked); false when not. */
export function takeUpHunting(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.hunt;
  if (takeUpPack(ctx, p)) return true;
  const short = foodShort(ctx, p);
  if (!short || !able(content, p, def.job)) return false;
  const crew = people(world).filter(
    (q) => q.id !== p.id && q['job'] === 'hunt' && q['task'] !== 'pack',
  ).length;
  if (crew >= def.crew) return false;
  if (outranked(ctx, p, def.job, (q) => chooseHerd(ctx, q) !== undefined)) return false;
  const herd = chooseHerd(ctx, p);
  const prey = herd && nearestOf(membersOf(world, herd.id), spotOf(p));
  if (!herd || !prey || !walkTo(ctx, p, spotOf(prey))) return false;
  const stock = content.work.stock.find((s) => s.good === 'food');
  p['took'] = ctx.emit('work.tookUpHunting', {
    causes: [
      stockOf(world, 'food')?.['line'] as number | undefined,
      priorityLine(world, p.id, def.job),
    ].filter((l): l is number => l !== undefined),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      species: speciesOf(content, herd['species'] as string).plural,
      good: stock?.name ?? 'food',
      ...short,
    },
  });
  Object.assign(p, { job: 'hunt', task: 'walk', target: herd.id, what: '', work: 0 });
  scaled(ctx, p, def.job, 1);
  return true;
}

/** The kill chance (per cent) of a stalk by `p`: skill, then their spear. */
function chanceOf(ctx: SystemContext, p: EntityRow): number {
  const def = ctx.content.work.hunt;
  const level = skillOf(ctx.world, p, ctx.content.jobs.find((j) => j.id === def.job)?.skill ?? '');
  return Math.floor(
    (Math.min(def.most, def.chance + def.perLevel * level) * toolPercent(ctx, p.id, def.job)) / 100,
  );
}

/** One minute at the hunt, once they are not walking. False when it is over. */
export function hunting(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.hunt;
  if (p['task'] === 'pack') return trackPack(ctx, p);
  const herd = herdOf(world, p['target'] as number);
  const animals = herd ? membersOf(world, herd.id) : [];
  const prey = nearestOf(animals, spotOf(p));
  if (!herd || !prey || animals.length <= content.wild.spare) return endHunt(p);
  const snare = def.snare.species.includes(herd['species'] as string);
  const running = !snare && animals.some((a) => a['state'] === 'flee');
  if (reach(spotOf(prey), spotOf(p)) > def.near || running) {
    // Out of range, or the herd running: after it, and waiting where they stand once beside it.
    p['task'] = 'walk';
    p['work'] = 0;
    if (running && reach(spotOf(prey), spotOf(p)) <= 1) {
      p['path'] = [];
      return true;
    }
    return walkTo(ctx, p, spotOf(prey)) || endHunt(p);
  }
  p['path'] = [];
  p['task'] = snare ? 'snare' : 'stalk';
  if ((p['work'] as number) <= 0) p['work'] = snare ? def.snare.every : def.every;
  p['work'] = (p['work'] as number) - 1;
  worked(ctx, p, def.job);
  practise(ctx, p, content.jobs.find((j) => j.id === def.job)?.skill ?? '', p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  if (!foodShort(ctx, p, true)) return endHunt(p);
  if (snare) {
    killAnimal(ctx, prey, p.id, p['took'] as number);
    p['work'] = 0;
  } else if (streamFor(world, 'wild').int(100) < chanceOf(ctx, p)) {
    killAnimal(ctx, prey, p.id, p['took'] as number);
    endHunt(p);
    return true;
  } else {
    scareHerd(ctx, herd.id);
    Object.assign(p, { task: 'walk', work: 0 });
  }
  return true;
}

/** Tracking the pack: walk along its trail towards it, and wait when it is in sight. */
function trackPack(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const prey = nearestOf(
    animalsOf(world).filter((a) => a['pack']),
    spotOf(p),
  );
  if (!prey) return endHunt(p);
  if (reach(spotOf(prey), spotOf(p)) <= content.wild.folk.sight.day) {
    p['path'] = [];
    return true;
  }
  return walkTo(ctx, p, spotOf(prey)) || endHunt(p);
}

/** Each minute, for anyone on the surface: a hunter stops walking once the game is within
 * `near`; fresh hoof prints under their feet turn a hunt towards that herd (once a hunt); fresh
 * wolf or bear prints near the town are found and remembered (flee.ts's sibling). */
export function tracksMinute(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const map = world.map;
  if (p['z'] !== 0) return;
  const def = content.work.hunt;
  if (
    p['job'] === 'hunt' &&
    p['task'] === 'walk' &&
    p['doing'] === 'work' &&
    (p['path'] as number[]).length
  ) {
    const herd = herdOf(world, p['target'] as number);
    const prey = herd && nearestOf(membersOf(world, herd.id), spotOf(p));
    // Within range of a calm herd they stop to stalk; one that is running is still followed.
    if (prey && reach(spotOf(prey), spotOf(p)) <= def.near && prey['state'] !== 'flee')
      p['path'] = [];
  }
  const i = (p['y'] as number) * map.width + (p['x'] as number);
  const print = map.printKind[i] ? printsAt(world, content, i) : undefined;
  if (!print || print.ageHours >= content.wild.folk.tracks.hours) return;
  if (print.kind === 'paw') pawsFound(ctx, p);
  else if (p['job'] === 'hunt' && p['task'] === 'walk' && p['what'] !== 'followed')
    followTracks(ctx, p, print);
}

/** Hoof prints: the huntable herd of that print nearest where they lead, if any. */
function followTracks(
  ctx: SystemContext,
  p: EntityRow,
  print: { kind: string; dir: number; ageHours: number },
): void {
  const { world, content } = ctx;
  const ahead = content.work.hunt.follow.ahead;
  const [dx, dy] = DIRS[print.dir]!;
  const to = { x: (p['x'] as number) + dx * ahead, y: (p['y'] as number) + dy * ahead, z: 0 };
  const snared = content.work.hunt.snare.species;
  const herd = huntable(world, content)
    .filter((h) => {
      const sp = speciesOf(content, h['species'] as string);
      return sp.print === print.kind && !snared.includes(sp.id);
    })
    .sort(
      (a, b) =>
        reach({ x: a['x'] as number, y: a['y'] as number, z: 0 }, to) -
          reach({ x: b['x'] as number, y: b['y'] as number, z: 0 }, to) || a.id - b.id,
    )[0];
  const prey = herd && nearestOf(membersOf(world, herd.id), spotOf(p));
  if (!herd || !prey) return;
  p['what'] = 'followed';
  ctx.emit('work.followedTracks', {
    causes: [p['took'] as number].filter((c) => c > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      species: speciesOf(content, herd['species'] as string).name,
      dir: dirWord(ctx, print.dir),
    },
  });
  if (p['target'] !== herd.id && walkTo(ctx, p, spotOf(prey))) p['target'] = herd.id;
}

/** Fresh wolf prints within the ring and `tracks.ring` tiles: the first of a day is a line, and
 * each who steps on them remembers (an awake person on the surface only). */
function pawsFound(ctx: SystemContext, p: EntityRow): void {
  const { world, content, state } = ctx;
  const green = greenOf(world);
  const r = ringOf(world, content) + content.wild.folk.tracks.ring;
  if (p['doing'] === 'sleep' || reach(spotOf(p), green) > r) return;
  const day = Math.floor(world.tick / TICKS_PER_DAY) + 1;
  const pack = packOf(world);
  if (state['tracksDay'] !== day && pack) {
    state['tracksDay'] = day;
    state['tracksLine'] = ctx.emit('wild.tracksFound', {
      causes: [pack['hungryLine'] as number].filter((c) => c > 0),
      actors: [p.id],
      data: { name: p['name'] as string, pack: pack['name'] as string },
    });
  }
  addMemory(ctx, p.id, content.wild.folk.memories.tracks, state['tracksLine'] ?? 0);
}
