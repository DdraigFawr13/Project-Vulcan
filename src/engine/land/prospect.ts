// Prospecting (6W Slice 7, V-215): nobody is sent (V-041). When a metal, or the cure's salt, is
// wanted and no seam of it is known (none found and still to work, no vein shown, no shaft going),
// Scouting wants a prospector: of the free who put Scouting no lower, the one with most mining
// skill (V-205's restless and hardy first does not apply). They pack and camp as a scout (V-206),
// make for the nearest rock face nobody has walked, the ore's liked rocks first, walk along the
// faces up to `prospect.day` minutes and come home. Faces walked are remembered (map `faces.ts`),
// with when and by what mining skill: a face is fresh again a year on, or at once for a better
// miner (V-223). With every face within `scout.far` tiles walked, the want waits for a change.
import { counted, TICKS_PER_DAY, type EntityRow, type Find } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { faceList, faceWalked, walkFaces } from '../map/index.ts';
import { saltCause, seamsOf } from '../mine/index.ts';
import { stockOf, wornTools } from '../goods/index.ts';
import { compass } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { canReach, walkAt, type Spot } from '../paths/index.ts';
import { able, levelOf, people, priorityLine, spotOf, walkTo } from '../band/index.ts';
import { isDown } from '../health/index.ts';
import { apart, unpack } from './camp.ts';
import { miningOf, oreKnown, oresWanted, oreWord, seamOres, type OreNeed } from './seams.ts';
import { alongWord, spendWord, wordOf } from './word.ts';
import type { Need } from './scout.ts';

/** An ore wanted and unknown, as a scouting need. */
export function oreAsNeed(ctx: SystemContext, ox: number, oy: number): Need | undefined {
  const ore = oreNeed(ctx, ox, oy);
  if (!ore) return undefined;
  const def = { good: ore.metal, kinds: [], find: '', unit: '' };
  return { def, name: oreWord(ctx, ore.f), have: 0, known: 0, want: ore.short, ore };
}

/** Each walked face's tile: the tick it was walked times 16, plus the walker's mining level. */
const walksOf = (ctx: SystemContext) => (ctx.world.systems['faces'] ??= {});

/** Whether face `i` is fresh for a prospector of mining level `skill` (V-223): never walked,
 * walked a year ago or more, or walked by a less skilled miner. A face marked walked with no
 * record of it stays walked. */
export function faceFresh(ctx: SystemContext, i: number, skill: number): boolean {
  const { world, content } = ctx;
  if (!faceWalked(world.map, i)) return true;
  const walk = walksOf(ctx)[i];
  if (walk === undefined) return false;
  const year = content.calendar.daysPerMonth * content.calendar.monthsPerYear * TICKS_PER_DAY;
  return world.tick - Math.floor(walk / 16) >= year || Math.min(15, skill) > walk % 16;
}

/** The faces within `far` of the green fresh for a prospector of mining level `skill`. */
function unwalked(ctx: SystemContext, ox: number, oy: number, skill: number): number[] {
  const map = ctx.world.map;
  const far = ctx.content.work.scout.far;
  return faceList(map).filter(
    (i) =>
      apart(i % map.width, Math.floor(i / map.width), ox, oy) <= far && faceFresh(ctx, i, skill),
  );
}

/** The best mining level among the living. */
const bestMining = (ctx: SystemContext): number =>
  Math.max(0, ...people(ctx.world).map((q) => (q['status'] === 'alive' ? miningOf(ctx, q) : 0)));

/** The first ore wanted and unknown while faces within reach are still unwalked; kept a tick. */
const NEEDS = new WeakMap<object, { tick: number; need: OreNeed | undefined }>();
export function oreNeed(ctx: SystemContext, ox: number, oy: number): OreNeed | undefined {
  const kept = NEEDS.get(ctx.world);
  if (kept?.tick === ctx.world.tick) return kept.need;
  const wanted = oresWanted(ctx);
  const need =
    wanted.length && unwalked(ctx, ox, oy, bestMining(ctx)).length ? wanted[0] : undefined;
  NEEDS.set(ctx.world, { tick: ctx.world.tick, need });
  return need;
}

/** Whether someone free who puts Scouting no lower than `p` has more mining skill (ties to the
 * lower id): then `p` waits for them to go. */
export function betterMiner(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const job = content.work.scout.job;
  const mine = miningOf(ctx, p);
  const rank = levelOf(world, content, p.id, job);
  return people(world).some((q) => {
    if (q.id === p.id || q['job'] !== '' || q['doing'] === 'sleep' || q['z'] !== 0) return false;
    if (q['status'] !== 'alive' || isDown(world, q.id) || !able(content, q, job)) return false;
    if (levelOf(world, content, q.id, job) > rank) return false;
    const theirs = miningOf(ctx, q);
    return theirs > mine || (theirs === mine && q.id < p.id);
  });
}

/** A walkable side of face `i` that `p` can get to; undefined for none. */
function sideOf(ctx: SystemContext, p: EntityRow, i: number): Spot | undefined {
  const map = ctx.world.map;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  for (const [dx, dy] of SIDES) {
    const [sx, sy] = [x + dx, y + dy];
    if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) continue;
    if (!walkAt(ctx.content, map, 0, sy * map.width + sx)) continue;
    const to = { x: sx, y: sy, z: 0 };
    if (canReach(ctx.content, map, spotOf(p), to)) return to;
  }
  return undefined;
}

/** The faces within `far` of (ox, oy) fresh for `p`, best first for `metal`: a rock the ore
 * likes first, then the nearest to (cx, cy), less `lean` along the word's way. */
function ranked(
  ctx: SystemContext,
  p: EntityRow,
  metal: string,
  [ox, oy]: readonly [number, number],
  [cx, cy]: readonly [number, number],
  far: number,
): number[] {
  const { content } = ctx;
  const map = ctx.world.map;
  const rocks = content.features.find((d) => d.id === metal)?.vein?.rocks ?? {};
  const ids = content.terrain.kinds.map((k) => k.id);
  const word = wordOf(ctx, content.work.scout.goods.length + seamOres(ctx).indexOf(metal));
  const scored: [number, number][] = [];
  for (const i of unwalked(ctx, ox, oy, miningOf(ctx, p))) {
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const d = apart(x, y, cx, cy);
    if (d > far) continue;
    const liked = rocks[ids[map.tiles[i]!]!] !== undefined ? 0 : 1000;
    const lean = word && alongWord(word, x - ox, y - oy) ? content.work.scout.prospect.word : 0;
    scored.push([liked + d - lean, i]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, i]) => i);
}

/** The side of the first face to make for, from the green: the best unwalked face within `far`
 * that `p` can get beside. */
export function faceTarget(
  ctx: SystemContext,
  p: EntityRow,
  need: OreNeed,
  ox: number,
  oy: number,
): Spot | undefined {
  const far = ctx.content.work.scout.far;
  for (const i of ranked(ctx, p, need.metal, [ox, oy], [ox, oy], far)) {
    const side = sideOf(ctx, p, i);
    if (side) return side;
  }
  return undefined;
}

/** The setting-out line: the stock level (or the curer's want) and the worn tools that ask for
 * the metal, the word that points the way, and the priority that put them to it. */
export function setOutProspecting(
  ctx: SystemContext,
  p: EntityRow,
  need: OreNeed,
  kit: string,
): number {
  const { world, content } = ctx;
  const salt = need.metal === content.work.cure.salt.item;
  const k = content.work.scout.goods.length + seamOres(ctx).indexOf(need.metal);
  const word = wordOf(ctx, k);
  if (word) spendWord(ctx);
  const plate = salt ? saltCause(world) : stockOf(world, `${need.metal}-ingot`)?.['line'];
  const worn = salt ? [] : wornTools(world, content).map((w) => w.item['worn'] as number);
  const causes = [plate, ...worn, word?.line, priorityLine(world, p.id, content.work.scout.job)];
  return ctx.emit('work.tookUpProspecting', {
    causes: [...new Set(causes.filter((l): l is number => typeof l === 'number' && l > 0))],
    actors: [p.id],
    data: { name: p['name'] as string, ore: oreWord(ctx, need.f), kit },
  });
}

/** A minute of the walk along the faces: faces within a tile of them are walked; once the ore is
 * known, the day is spent or no face lies within `prospect.along`, they turn for home. Returns
 * whether they are still at it. */
export function alongFaces(ctx: SystemContext, p: EntityRow, trip: Find): boolean {
  const { world, content } = ctx;
  const def = content.work.scout.prospect;
  if (!trip.along) trip.along = world.tick + def.day;
  if (world.tick >= trip.along || oreKnown(ctx, trip.good)) return false;
  const g = greenOf(world);
  const here: [number, number] = [p['x'] as number, p['y'] as number];
  // The faces along from here first; with none, on to the next unwalked face wherever it is.
  for (const reach of [def.along, 2 * content.work.scout.far])
    for (const i of ranked(ctx, p, trip.good, [g.x, g.y], here, reach).slice(0, 8)) {
      const side = sideOf(ctx, p, i);
      if (side && (side.x !== here[0] || side.y !== here[1]) && walkTo(ctx, p, side)) return true;
    }
  return false;
}

const SIDES = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;

/** Each minute of an ore trip on the surface: the faces beside them fresh for them are walked,
 * and when and by what skill is kept. */
export function walkTrip(ctx: SystemContext, p: EntityRow, trip: Find): void {
  if (p['z'] !== 0) return;
  const skill = miningOf(ctx, p);
  const fresh = (i: number) => faceFresh(ctx, i, skill);
  const walked = walkFaces(ctx.world.map, p['x'] as number, p['y'] as number, fresh);
  const walks = walksOf(ctx);
  for (const i of walked) walks[i] = ctx.world.tick * 16 + Math.min(15, skill);
  if (walked.length) trip.faces = (trip.faces ?? 0) + walked.length;
}

/** Home from prospecting: the seam they found (told of, citing it), or no word and the faces
 * walked; the trip waits `scout.wait` days like any with no word. */
export function prospectHome(ctx: SystemContext, p: EntityRow, trip: Find): void {
  const { world } = ctx;
  if (p['packed']) unpack(ctx, p);
  const f = ctx.content.features.findIndex((d) => d.id === trip.good) + 1;
  const seam = seamsOf(world, trip.good).find((s) => s.by === p.id && s.tick >= trip.tick);
  const g = greenOf(world);
  const line = seam
    ? ctx.emit('land.toldOfSeam', {
        causes: [trip.line, seam.line],
        actors: [p.id],
        data: {
          name: p['name'] as string,
          colour: ctx.content.features[f - 1]!.vein!.seam!,
          ore: oreWord(ctx, f),
          far: apart(seam.x, seam.y, g.x, g.y),
          dir: compass(seam.x - g.x, seam.y - g.y),
        },
      })
    : ctx.emit('land.noSeam', {
        causes: [trip.line],
        actors: [p.id],
        data: {
          name: p['name'] as string,
          ore: oreWord(ctx, f),
          faces: trip.faces ?? 0,
          walked: counted(trip.faces ?? 0, 'rock faces'),
          them: trip.faces === 1 ? 'it' : 'them',
        },
      });
  Object.assign(trip, { count: 0, line, tick: world.tick });
}
