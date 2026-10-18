// Work (P2.4): nobody is told what to do (V-015). In working hours a free person looks at what
// the colony wants and takes something up themselves: while it has less wood than its stock
// level asks for, someone able to fell (jobs.json `fell`: its strength and skill) picks a tree
// (a fallen log first, then the standing tree nearest the store, never close to the camp),
// works it down and leaves the logs where it stood; anyone free carries what lies outside the
// store into it, onto a matching stack. Quarrying (P3.1) is felling's twin for stone: boulders
// broken up while the colony has less stone than it wants. Building is build.ts. Taking up
// felling or quarrying and each tree felled or boulder broken are ledger lines; trips are not.
import { raiseChunk } from '../map/index.ts';
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import {
  growStore,
  haveOf,
  inStore,
  itemsAt,
  itemsOf,
  layItem,
  markedTree,
  slotFor,
  stockOf,
  storeOf,
  takeFrom,
  unmark,
  wantOf,
} from '../goods/index.ts';
import { canReach, walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { building, takeUpBuilding } from './build.ts';
import { foraging, takeUpForaging } from './forage.ts';
import { practise } from './learn.ts';
import { busy, goBeside, layAround, people, same, skillOf, SIDES, spotOf } from './spots.ts';
import { able, declineIfUnable, jobsInOrder, outranked, priorityLine } from './priority.ts';
import { tallyAdd } from './tally.ts';
import { walkTo } from './walk.ts';

export const JOB_FIELDS = {
  /** `fell`, `quarry`, `forage`, `build`, `haul` or '' (none). */
  job: 'text',
  /** The tile being felled or quarried, or the item going to be fetched; -1 for none. */
  target: 'int',
  /** Minutes of felling or quarrying left on the target. */
  work: 'int',
  /** Their line taking up the work, which each tree they fell (or part they build) cites. */
  took: 'event',
  /** The plan they are building (P3.1), or 0. */
  plan: 'int',
  /** The tick before which they do not look for work again after finding none. */
  next: 'int',
} as const;

const LOOK_AGAIN = 30;

/** Work that takes a feature off the map for what it yields: felling (logs) and quarrying (P3.1,
 * stone). `kinds` are the feature kinds worked, preferred in that order. */
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

/** What to work next: a fallen log before a tree, then the one nearest the store. */
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
  for (let y = Math.max(0, oy - reach); y <= Math.min(map.height - 1, oy + reach); y += 1)
    for (let x = Math.max(0, ox - reach); x <= Math.min(map.width - 1, ox + reach); x += 1) {
      const i = y * map.width + x;
      const def = sourceAt(world, content, i, g);
      if (!def || taken.has(i)) continue;
      if (Math.max(Math.abs(x - map.startX), Math.abs(y - map.startY)) <= camp) continue;
      const s = g.kinds.indexOf(def.kind) * 100000 + Math.max(Math.abs(x - ox), Math.abs(y - oy));
      if (s >= score) continue;
      const reachable = SIDES.some(([dx, dy]) => {
        const [sx, sy] = [x + dx, y + dy];
        if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) return false;
        if (!walkAt(content, map, 0, sy * map.width + sx)) return false;
        return canReach(content, map, from, { x: sx, y: sy, z: 0 });
      });
      if (reachable) [best, score] = [i, s];
    }
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
  map.features[i] = 0;
  unmark(world, x, y);
  map.tileCauses[i] = line;
  raiseChunk(map, x, y);
  const laid = layAround(ctx, def.yields!, def.amount, { x, y, z: 0 }, line);
  if (g.job === 'fell') tallyAdd(ctx, 'felled', laid);
}

/** Carrying: to the store with what they hold; the store grows when the load finds no room. */
function deliver(ctx: SystemContext, p: EntityRow, load: EntityRow): void {
  const { world, content } = ctx;
  const kind = load['kind'] as string;
  const count = load['count'] as number;
  const here = spotOf(p);
  const slot = slotFor(world, content, kind, count, here) ?? growStore(ctx, load['made'] as number);
  if (!slot) {
    // Nowhere to put it: set it down here and look for work again later.
    Object.assign(load, { ...here, holder: 0 });
    p['next'] = world.tick + LOOK_AGAIN;
    p['job'] = '';
    return;
  }
  if (!same(slot, here)) {
    if (!walkTo(ctx, p, slot)) {
      Object.assign(load, { ...here, holder: 0 });
      p['job'] = '';
    }
    return;
  }
  tallyAdd(ctx, 'hauled', count);
  const stack = itemsAt(world, here.x, here.y, here.z).find((i) => i['kind'] === kind);
  if (stack) {
    stack['count'] = (stack['count'] as number) + count;
    takeFrom(world, load, count);
  } else Object.assign(load, { ...here, holder: 0 });
  p['job'] = '';
}

/** Picks up what lies on their tile: all of it, or a load. */
function pickUp(ctx: SystemContext, p: EntityRow, item: EntityRow): void {
  const load = ctx.content.work.haul.load;
  const count = item['count'] as number;
  if (count <= load) {
    item['holder'] = p.id;
    return;
  }
  takeFrom(ctx.world, item, load);
  const id = layItem(ctx.world, {
    kind: item['kind'] as string,
    count: load,
    ...spotOf(p),
    made: item['made'] as number,
  });
  const carried = itemsOf(ctx.world).find((i) => i.id === id)!;
  carried['holder'] = p.id;
}

/** Something lying outside the store that should be carried in, nearest them. */
function chooseLoad(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const kinds = content.work.haul.kinds;
  const taken = busy(world, p, 'haul');
  const from = spotOf(p);
  let best: EntityRow | undefined;
  let far = Infinity;
  for (const i of itemsOf(world)) {
    if (i['holder'] || !kinds.includes(i['kind'] as string) || taken.has(i.id)) continue;
    const at = spotOf(i);
    if (inStore(world, at.x, at.y, at.z)) continue;
    const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y));
    if (d < far && canReach(content, world.map, from, at)) [best, far] = [i, d];
  }
  return best;
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

/** One minute of work for someone free; false when there is nothing for them to do. */
export function working(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const walking = (p['path'] as number[]).length > 0;
  if (p['doing'] === 'work' && walking) return true;
  if (p['job'] === 'build' && hours && building(ctx, p)) return true;
  const load = itemsOf(world).find((i) => i['holder'] === p.id);
  if (load) {
    p['job'] = 'haul';
    deliver(ctx, p, load);
    return true;
  }
  if (!hours) return false;
  const target = p['target'] as number;
  const g = gatherOf(content, p['job']);
  if (g && target >= 0 && sourceAt(world, content, target, g)) {
    const [tx, ty] = [target % map.width, Math.floor(target / map.width)];
    const here = spotOf(p);
    if (here.z === 0 && Math.abs(here.x - tx) + Math.abs(here.y - ty) === 1) {
      p['work'] = (p['work'] as number) - 1;
      practise(ctx, p, jobSkill(content, g), p['took'] as number);
      if ((p['work'] as number) <= 0) {
        fell(ctx, p, target, g);
        p['target'] = -1;
      }
      return true;
    }
    if (goBeside(ctx, p, tx, ty)) return true;
    p['target'] = -1;
  }
  if (p['job'] === 'forage' && target >= 0 && foraging(ctx, p)) return true;
  if (p['job'] === 'haul' && target >= 0) {
    const item = itemsOf(world).find((i) => i.id === target && !i['holder']);
    if (item && same(spotOf(item), spotOf(p))) {
      pickUp(ctx, p, item);
      p['target'] = -1;
      return true;
    }
    if (item && walkTo(ctx, p, spotOf(item))) return true;
    p['target'] = -1;
  }
  if (world.tick < (p['next'] as number)) return false;
  return takeUp(ctx, p);
}

/** Chooses new work: a marked tree first (test mode), then the Work sheet's kinds of work in
 * their own priority order (priority.ts): felling while wood is short, else carrying. */
function takeUp(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const fellDef = content.work.fell;
  const marked = able(content, p, fellDef.job)
    ? markedTree(world, content, busy(world, p, 'fell'), spotOf(p), (x, y) =>
        goBeside(ctx, p, x, y),
      )
    : undefined;
  if (marked) {
    p['took'] = ctx.emit('work.tookUpMarked', {
      causes: [marked.line],
      actors: [p.id],
      data: { name: p['name'] as string },
    });
    return startGathering(ctx, p, marked.tree, gatherOf(content, 'fell')!);
  }
  for (const job of jobsInOrder(world, content, p)) if (TAKE_UP[job]?.(ctx, p)) return true;
  p['job'] = '';
  p['target'] = -1;
  p['next'] = world.tick + LOOK_AGAIN;
  return false;
}

/** Felling (quarrying), while the colony's wood (stone) is short of its stock level, unless
 * they are not able (and say so if the player raised it for them) or someone free puts it
 * higher. */
function takeUpGathering(ctx: SystemContext, p: EntityRow, g: Gather): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const job = g.def.job;
  const short = shortOf(ctx, p, g);
  if (!short) return false;
  if (!able(content, p, job)) {
    declineIfUnable(ctx, p, job);
    return false;
  }
  if (outranked(ctx, p, job, (q) => chooseSource(ctx, q, g) !== undefined)) return false;
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
          priorityLine(world, p.id, job),
        ].filter((l): l is number => l !== undefined),
      ],
      actors: [p.id],
      data: { name: p['name'] as string, work: g.word, good, ...short },
    });
  }
  return startGathering(ctx, p, tree, g);
}

/** Carrying the nearest load lying outside the store. */
function takeUpHauling(ctx: SystemContext, p: EntityRow): boolean {
  const item = chooseLoad(ctx, p);
  if (!item || !walkTo(ctx, p, spotOf(item))) return false;
  p['job'] = 'haul';
  p['target'] = item.id;
  return true;
}

/** How each kind of work on the Work sheet is taken up; a kind with no entry is never taken up
 * (content `work.priority.jobs` may list one before its milestone brings the work). */
const TAKE_UP: Readonly<Record<string, (ctx: SystemContext, p: EntityRow) => boolean>> = {
  fell: (ctx, p) => takeUpGathering(ctx, p, gatherOf(ctx.content, 'fell')!),
  haul: takeUpHauling,
  forage: takeUpForaging,
  build: takeUpBuilding,
  quarry: (ctx, p) => takeUpGathering(ctx, p, gatherOf(ctx.content, 'quarry')!),
};

const jobSkill = (content: EngineContent, g: Gather): string =>
  content.jobs.find((j) => j.id === g.def.job)?.skill ?? '';

/** Sets them working the feature at surface tile `tree` (they are already on their way to it). */
function startGathering(ctx: SystemContext, p: EntityRow, tree: number, g: Gather): boolean {
  const level = skillOf(ctx.world, p, jobSkill(ctx.content, g));
  p['job'] = g.job;
  p['target'] = tree;
  p['work'] = Math.ceil((g.def.minutes * 2 * g.def.skilled) / (g.def.skilled + level));
  return true;
}
