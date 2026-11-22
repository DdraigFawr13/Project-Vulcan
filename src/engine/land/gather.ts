// Felling and quarrying (P2.4, P3.1, V-015): work that takes a feature off the map for what it
// yields. Under the wood (stone) stock level, someone able picks a tree (a fallen log first, then
// the standing one nearest the store, never close to the camp) or a boulder and leaves its logs
// (stone) where it stood. Test-mode marks and a house's site come first (`takeUpMarked`).
import { houseName } from '../build/index.ts';
import { eachKnown, raiseChunk, workAreas } from '../map/index.ts';
import { noteFelled } from './regrow.ts';
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { haveOf, markedTree, stockOf, storeOf, unmark, wantOf } from '../goods/index.ts';
import { canReach, walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, busy, declineIfUnable, goBeside, layAround, outranked } from '../band/index.ts';
import { people, practise, priorityLine, scaled, SIDES, skillOf, spotOf } from '../band/index.ts';
import { couldHave, readyFor, tallyAdd, worked } from '../band/index.ts';

/** `kinds` are the feature kinds worked, preferred in that order. */
interface Gather {
  job: 'fell' | 'quarry';
  def: { job: string; minutes: number; skilled: number; camp: number; reach: number };
  good: string;
  kinds: readonly string[];
  word: string;
}

function gatherOf(content: EngineContent, job: unknown): Gather | undefined {
  if (job === 'fell')
    return {
      job,
      def: content.work.fell,
      good: content.work.stock[0]?.good ?? 'logs',
      kinds: ['log', 'tree'],
      word: 'felling',
    };
  if (job === 'quarry')
    return {
      job,
      def: content.work.quarry,
      good: content.work.quarry.good,
      kinds: ['boulder'],
      word: 'quarrying',
    };
  return undefined;
}

/** The feature at surface tile `i` that this work takes, if any. */
function sourceAt(world: WorldState, content: EngineContent, i: number, g: Gather) {
  const f = world.map.features[i]!;
  const def = f ? content.features[f - 1] : undefined;
  return def && g.kinds.includes(def.kind) ? def : undefined;
}

/** Whether they can stand on a tile beside surface tile (x, y) and get there. */
function besideFrom(ctx: SystemContext, from: ReturnType<typeof spotOf>, x: number, y: number) {
  const { content, world } = ctx;
  const map = world.map;
  return SIDES.some(([dx, dy]) => {
    const [sx, sy] = [x + dx, y + dy];
    if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) return false;
    if (!walkAt(content, map, 0, sy * map.width + sx)) return false;
    return canReach(content, map, from, { x: sx, y: sy, z: 0 });
  });
}

/** What to work next: a fallen log before a tree, then the one nearest the store, on known
 * ground within reach of the store or round a scout's find (V-204). */
function chooseSource(ctx: SystemContext, p: EntityRow, g: Gather): number | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const { reach, camp } = g.def;
  const first = storeOf(world)[0];
  const [ox, oy] = first ? [first['x'] as number, first['y'] as number] : [map.startX, map.startY];
  const taken = busy(world, p, g.job);
  const from = spotOf(p);
  let best: number | undefined;
  let score = Infinity;
  eachKnown(map, workAreas(content, map, ox, oy, reach), (i, x, y) => {
    const def = sourceAt(world, content, i, g);
    if (!def || taken.has(i)) return;
    if (Math.max(Math.abs(x - map.startX), Math.abs(y - map.startY)) <= camp) return;
    const s = g.kinds.indexOf(def.kind) * 100000 + Math.max(Math.abs(x - ox), Math.abs(y - oy));
    if (s < score && besideFrom(ctx, from, x, y)) [best, score] = [i, s];
  });
  return best;
}

/** The tree comes down (or the boulder is broken up): the feature goes, what it yields lies
 * there, one line. */
function fell(ctx: SystemContext, p: EntityRow, i: number, g: Gather): void {
  const { world, content } = ctx;
  const map = world.map;
  const def = sourceAt(world, content, i, g);
  if (!def) return;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  const good = content.items.find((it) => it.id === def.yields)?.name ?? def.yields;
  const verb = def.kind === 'log' ? 'cut up' : def.kind === 'tree' ? 'felled' : 'broke up';
  const name = def.name.toLowerCase();
  const line = ctx.emit('work.felled', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      verb,
      what: `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`,
      count: def.amount,
      good,
    },
  });
  if (g.job === 'fell' && def.kind === 'tree') noteFelled(ctx, i, map.features[i]!);
  map.features[i] = 0;
  unmark(world, x, y);
  map.tileCauses[i] = line;
  raiseChunk(map, x, y);
  const laid = layAround(ctx, def.yields!, def.amount, { x, y, z: 0 }, line);
  if (g.job === 'fell') tallyAdd(ctx, 'felled', laid);
}

/** Felling (quarrying) is wanted when the colony has less wood (stone) than its stock level
 * asks, counting what others are already working on, so no more take it up than are needed. */
function shortOf(
  ctx: SystemContext,
  p: EntityRow,
  g: Gather,
): { have: number; want: number } | undefined {
  const { world, content } = ctx;
  const want = wantOf(world, content, g.good);
  if (want <= 0) return undefined;
  const have = haveOf(world, content, g.good);
  let coming = 0;
  for (const q of people(world))
    if (q.id !== p.id && q['job'] === g.job && (q['target'] as number) >= 0)
      coming += sourceAt(world, content, q['target'] as number, g)?.amount ?? 0;
  return have + coming < want ? { have, want } : undefined;
}

const jobSkill = (content: EngineContent, g: Gather): string =>
  content.jobs.find((j) => j.id === g.def.job)?.skill ?? '';

/** Sets them working the feature at surface tile `tree` (they are already on their way to it). */
function startGathering(ctx: SystemContext, p: EntityRow, tree: number, g: Gather): boolean {
  const level = skillOf(ctx.world, p, jobSkill(ctx.content, g));
  p['job'] = g.job;
  p['target'] = tree;
  const minutes = Math.ceil((g.def.minutes * 2 * g.def.skilled) / (g.def.skilled + level));
  p['work'] = scaled(ctx, p, g.job, minutes);
  return true;
}

/** A minute at the tree (boulder) they are working, or on the way beside it; false when it has
 * gone or cannot be reached (and they let it go). */
export function gatherMinute(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const target = p['target'] as number;
  const g = gatherOf(content, p['job']);
  if (!g || !sourceAt(world, content, target, g)) return false;
  const [tx, ty] = [target % map.width, Math.floor(target / map.width)];
  const here = spotOf(p);
  if (here.z === 0 && Math.abs(here.x - tx) + Math.abs(here.y - ty) === 1) {
    p['work'] = (p['work'] as number) - 1;
    worked(ctx, p, g.job);
    practise(ctx, p, jobSkill(content, g), p['took'] as number);
    if ((p['work'] as number) <= 0) {
      fell(ctx, p, target, g);
      p['target'] = -1;
    }
    return true;
  }
  if (goBeside(ctx, p, tx, ty)) return true;
  p['target'] = -1;
  return false;
}

/** The nearest marked tree they can get beside: a test-mode order's, or (`forHouse`, P3.7) one
 * on a house's site or its way in, which is felling work in its place on the Work sheet. */
export function takeUpMarked(ctx: SystemContext, p: EntityRow, forHouse: boolean): boolean {
  const { world, content } = ctx;
  if (!able(content, p, content.work.fell.job)) return false;
  const marked = markedTree(
    world,
    content,
    busy(world, p, 'fell'),
    spotOf(p),
    (x, y) => goBeside(ctx, p, x, y),
    forHouse,
  );
  if (!marked) return false;
  // An axe is needed (V-195): without one they knap their own or do other work.
  const tool = readyFor(ctx, p, 'fell');
  if (tool !== 'ok') {
    if (tool === 'none') p['path'] = [];
    return tool === 'knap';
  }
  const site = forHouse ? houseName(world, content, marked.house) : '';
  p['took'] = ctx.emit(forHouse ? 'work.tookUpClearing' : 'work.tookUpMarked', {
    causes: [marked.line],
    actors: [p.id],
    data: { name: p['name'] as string, ...(site && { size: site }) },
  });
  return startGathering(ctx, p, marked.tree, gatherOf(content, 'fell')!);
}

/** Felling (quarrying), while the colony's wood (stone) is short of its stock level, unless
 * they are not able (and say so if the player raised it for them) or someone free puts it
 * higher. */
export function takeUpGathering(ctx: SystemContext, p: EntityRow, job: 'fell' | 'quarry'): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const g = gatherOf(content, job)!;
  const short = shortOf(ctx, p, g);
  if (!short) return false;
  if (!able(content, p, g.def.job)) {
    declineIfUnable(ctx, p, g.def.job);
    return false;
  }
  const can = (q: EntityRow) => couldHave(ctx, q, g.job) && chooseSource(ctx, q, g) !== undefined;
  if (outranked(ctx, p, g.def.job, can)) return false;
  // A felling or quarrying tool is needed (V-195): without one they knap their own or do other work.
  const tool = readyFor(ctx, p, g.job);
  if (tool !== 'ok') return tool === 'knap';
  const tree = chooseSource(ctx, p, g);
  if (tree === undefined || !goBeside(ctx, p, tree % map.width, Math.floor(tree / map.width)))
    return false;
  if (p['job'] !== g.job) {
    const good = content.work.stock.find((s) => s.good === g.good)?.name ?? g.good;
    p['took'] = ctx.emit('work.tookUp', {
      // The stock level that wants it, and the priority that put them to it if the player set one.
      causes: [
        ...[
          stockOf(world, g.good)?.['line'] as number | undefined,
          priorityLine(world, p.id, g.def.job),
        ].filter((l): l is number => l !== undefined),
      ],
      actors: [p.id],
      data: { name: p['name'] as string, work: g.word, good, ...short },
    });
  }
  return startGathering(ctx, p, tree, g);
}
