// Work (P2.4): nobody is told what to do (V-015). In working hours a free person looks at what
// the colony wants and takes something up themselves: while it has less wood than its stock
// level asks for, someone able to fell (jobs.json `fell`: its strength and skill) picks a tree
// (a fallen log first, then the standing tree nearest the store, never close to the camp),
// works it down and leaves the logs where it stood; anyone free carries what lies outside the
// store into it, onto a matching stack. Taking up felling and each tree felled are ledger lines;
// trips are not.
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
  stackSize,
  stockOf,
  storeOf,
  takeFrom,
  unmark,
  wantOf,
} from '../goods/index.ts';
import { canReach, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { walkTo } from './walk.ts';

export const JOB_FIELDS = {
  /** `fell`, `haul` or '' (none). */
  job: 'text',
  /** The tile being felled, or the item going to be fetched; -1 for none. */
  target: 'int',
  /** Minutes of felling left on the target. */
  work: 'int',
  /** Their line taking up felling, which each tree they fell cites. */
  took: 'event',
  /** The tick before which they do not look for work again after finding none. */
  next: 'int',
} as const;

const LOOK_AGAIN = 30;
/** A tree is worked from a side, never a corner, so its tile (and the logs on it) can be reached
 * from where they stood: a corner step past two blocked sides is not allowed (paths). */
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const spotOf = (r: EntityRow): Spot => ({
  x: r['x'] as number,
  y: r['y'] as number,
  z: r['z'] as number,
});
const same = (a: Spot, b: Spot): boolean => a.x === b.x && a.y === b.y && a.z === b.z;
const people = (world: WorldState): EntityRow[] => world.entities['person'] ?? [];
/** The targets others are already on in a job, so no two take the same tree or load. */
const busy = (world: WorldState, p: EntityRow, job: string): Set<number> =>
  new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === job)
      .map((q) => q['target'] as number),
  );

/** Whether a person meets a job's requirements (attributes) in jobs.json. */
function able(content: EngineContent, p: EntityRow, job: string): boolean {
  const def = content.jobs.find((j) => j.id === job);
  if (!def) return false;
  return Object.entries(def.requirements).every(([a, n]) => ((p[a] as number) ?? 0) >= n);
}

const skillOf = (world: WorldState, p: EntityRow, skill: string): number =>
  ((world.entities['skill'] ?? []).find((s) => s['person'] === p.id && s['skill'] === skill)?.[
    'level'
  ] as number) ?? 0;

/** A tree feature (or fallen log) at surface tile `i` that yields logs. */
function treeAt(world: WorldState, content: EngineContent, i: number) {
  const f = world.map.features[i]!;
  const def = f ? content.features[f - 1] : undefined;
  return def && (def.kind === 'tree' || def.kind === 'log') ? def : undefined;
}

/** Sets off to stand beside surface tile (x, y); false when no side of it can be reached. */
function goBeside(ctx: SystemContext, p: EntityRow, x: number, y: number): boolean {
  const map = ctx.world.map;
  const here = spotOf(p);
  const sides = SIDES.map(([dx, dy]) => ({ x: x + dx, y: y + dy, z: 0 }))
    .filter((s) => s.x >= 0 && s.y >= 0)
    .filter((s) => s.x < map.width && s.y < map.height)
    .filter((s) => walkAt(ctx.content, map, 0, s.y * map.width + s.x) > 0)
    .sort(
      (a, b) =>
        Math.abs(a.x - here.x) +
        Math.abs(a.y - here.y) -
        Math.abs(b.x - here.x) -
        Math.abs(b.y - here.y),
    );
  for (const s of sides) {
    if (same(s, here)) return true;
    if (canReach(ctx.content, map, here, s) && walkTo(ctx, p, s)) return true;
  }
  return false;
}

/** The tree to fell next: a fallen log first, then the standing tree nearest the store. */
function chooseTree(ctx: SystemContext, p: EntityRow): number | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const { reach, camp } = content.work.fell;
  const first = storeOf(world)[0];
  const [ox, oy] = first ? [first['x'] as number, first['y'] as number] : [map.startX, map.startY];
  const taken = busy(world, p, 'fell');
  const from = spotOf(p);
  let best: number | undefined;
  let score = Infinity;
  for (let y = Math.max(0, oy - reach); y <= Math.min(map.height - 1, oy + reach); y += 1)
    for (let x = Math.max(0, ox - reach); x <= Math.min(map.width - 1, ox + reach); x += 1) {
      const i = y * map.width + x;
      const def = treeAt(world, content, i);
      if (!def || taken.has(i)) continue;
      if (Math.max(Math.abs(x - map.startX), Math.abs(y - map.startY)) <= camp) continue;
      const s = (def.kind === 'log' ? 0 : 100000) + Math.max(Math.abs(x - ox), Math.abs(y - oy));
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

/** Lays `count` of a kind in stacks on the tile and the free open tiles around it. */
function layAround(ctx: SystemContext, kind: string, count: number, at: Spot, made: number): void {
  const { world, content } = ctx;
  const map = world.map;
  const size = stackSize(content, kind);
  let left = count;
  for (let r = 0; left > 0 && r <= 4; r += 1)
    for (let dy = -r; dy <= r && left > 0; dy += 1)
      for (let dx = -r; dx <= r && left > 0; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const [x, y] = [at.x + dx, at.y + dy];
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (!walkAt(content, map, 0, y * map.width + x) || itemsAt(world, x, y, 0).length) continue;
        if (!canReach(content, map, at, { x, y, z: 0 })) continue;
        const n = Math.min(size, left);
        layItem(world, { kind, count: n, x, y, z: 0, made });
        left -= n;
      }
}

/** The tree comes down: the feature goes, the logs lie there, one line. */
function fell(ctx: SystemContext, p: EntityRow, i: number): void {
  const { world, content } = ctx;
  const map = world.map;
  const def = treeAt(world, content, i);
  if (!def) return;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  const good = content.items.find((it) => it.id === def.yields)?.name ?? def.yields;
  const log = def.kind === 'log';
  const name = def.name.toLowerCase();
  const line = ctx.emit('work.felled', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      verb: log ? 'cut up' : 'felled',
      what: `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`,
      count: def.amount,
      good,
    },
  });
  map.features[i] = 0;
  unmark(world, x, y);
  map.tileCauses[i] = line;
  raiseChunk(map, x, y);
  layAround(ctx, def.yields, def.amount, { x, y, z: 0 }, line);
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

/** Felling is wanted when the colony has less wood than its stock level asks, counting the
 * logs of trees others are already working on, so no more take it up than are needed. */
function woodShort(ctx: SystemContext, p: EntityRow): { have: number; want: number } | undefined {
  const { world, content } = ctx;
  const good = content.work.stock[0]?.good ?? 'logs';
  const want = wantOf(world, content, good);
  const have = haveOf(world, good);
  let coming = 0;
  for (const q of people(world))
    if (q.id !== p.id && q['job'] === 'fell' && (q['target'] as number) >= 0)
      coming += treeAt(world, content, q['target'] as number)?.amount ?? 0;
  return have + coming < want ? { have, want } : undefined;
}

/** One minute of work for someone free; false when there is nothing for them to do. */
export function working(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const walking = (p['path'] as number[]).length > 0;
  if (p['doing'] === 'work' && walking) return true;
  const load = itemsOf(world).find((i) => i['holder'] === p.id);
  if (load) {
    p['job'] = 'haul';
    deliver(ctx, p, load);
    return true;
  }
  if (!hours) return false;
  const target = p['target'] as number;
  if (p['job'] === 'fell' && target >= 0 && treeAt(world, content, target)) {
    const [tx, ty] = [target % map.width, Math.floor(target / map.width)];
    const here = spotOf(p);
    if (here.z === 0 && Math.abs(here.x - tx) + Math.abs(here.y - ty) === 1) {
      p['work'] = (p['work'] as number) - 1;
      if ((p['work'] as number) <= 0) {
        fell(ctx, p, target);
        p['target'] = -1;
      }
      return true;
    }
    if (goBeside(ctx, p, tx, ty)) return true;
    p['target'] = -1;
  }
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

/** Chooses new work: felling when wood is short and they are able, else carrying. */
function takeUp(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const fellDef = content.work.fell;
  const short = woodShort(ctx, p);
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
    return startFelling(ctx, p, marked.tree);
  }
  if (short && able(content, p, fellDef.job)) {
    const tree = chooseTree(ctx, p);
    if (tree !== undefined && goBeside(ctx, p, tree % map.width, Math.floor(tree / map.width))) {
      if (p['job'] !== 'fell') {
        const stock = content.work.stock[0];
        const good = stock?.name ?? 'wood';
        p['took'] = ctx.emit('work.tookUp', {
          causes: [stockOf(world, stock?.good ?? 'logs')?.['line'] as number],
          actors: [p.id],
          data: { name: p['name'] as string, good, ...short },
        });
      }
      return startFelling(ctx, p, tree);
    }
  }
  const item = chooseLoad(ctx, p);
  if (item && walkTo(ctx, p, spotOf(item))) {
    p['job'] = 'haul';
    p['target'] = item.id;
    return true;
  }
  p['job'] = '';
  p['target'] = -1;
  p['next'] = world.tick + LOOK_AGAIN;
  return false;
}

/** Sets them felling the tree at surface tile `tree` (they are already on their way to it). */
function startFelling(ctx: SystemContext, p: EntityRow, tree: number): boolean {
  const fellDef = ctx.content.work.fell;
  const skill = ctx.content.jobs.find((j) => j.id === fellDef.job)?.skill ?? '';
  const level = skillOf(ctx.world, p, skill);
  p['job'] = 'fell';
  p['target'] = tree;
  p['work'] = Math.ceil((fellDef.minutes * 2 * fellDef.skilled) / (fellDef.skilled + level));
  return true;
}
