// Foraging (P2.9, V-015): nobody is told to pick berries. While the colony has less food than its
// stock level asks for (counting the berries others are walking to), a free person takes up
// foraging: the nearest ripe bush within `forage.reach` of the store, worked from beside it for
// `minutes` (shorter with skill), and the bush's berries lie around it for haulers to carry in.
// The bush stays on the map. A picked bush is ripe again after `regrowDays`, and only in the
// named `months`; the picked bushes are the `bush` table. Taking up foraging and each bush
// picked are ledger lines; trips are not.
import { clockAt, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { haveOf, stockOf, storeOf, wantOf } from '../goods/index.ts';
import { reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { besideReachable, busy, goBeside, layAround, people, skillOf, spotOf } from './spots.ts';
import { tallyAdd } from './tally.ts';

export const FORAGE_TABLES: Schemas = {
  /** A bush that has been picked: its tile, the tick, and the line that records it. */
  bush: { x: 'int', y: 'int', picked: 'int', line: 'event' },
};

const TICKS_PER_DAY = 1440;

/** The berry bush (or other bush that yields something) on surface tile `i`. */
function bushAt(world: WorldState, content: EngineContent, i: number) {
  const f = world.map.features[i]!;
  const def = f ? content.features[f - 1] : undefined;
  return def && def.kind === 'bush' && def.yields ? def : undefined;
}

const pickedRow = (world: WorldState, x: number, y: number): EntityRow | undefined =>
  (world.entities['bush'] ?? []).find((b) => b['x'] === x && b['y'] === y);

/** Whether this is a month bushes bear in. */
function inSeason(world: WorldState, content: EngineContent): boolean {
  const month = content.calendar.monthNames[clockAt(world.tick, content.calendar).month] ?? '';
  return content.work.forage.months.includes(month);
}

/** Not picked, or not for `regrowDays`. */
const regrown = (world: WorldState, content: EngineContent, x: number, y: number): boolean => {
  const row = pickedRow(world, x, y);
  return (
    !row || world.tick - (row['picked'] as number) >= content.work.forage.regrowDays * TICKS_PER_DAY
  );
};

/** Ripe when it is in season and it was never picked or not for `regrowDays`. */
export const ripe = (world: WorldState, content: EngineContent, x: number, y: number): boolean =>
  inSeason(world, content) && regrown(world, content, x, y);

/** The surface tiles that hold a bush, found once per map: bushes are never planted or cleared,
 * so the list is the same however and whenever it is first made (a loaded world makes the same
 * one). Whether one can be reached is asked when it is chosen, against the ground as it is now. */
const BUSHES = new WeakMap<object, number[]>();
function bushesOf(world: WorldState, content: EngineContent): number[] {
  let tiles = BUSHES.get(world.map);
  if (!tiles) {
    tiles = [];
    for (let i = 0; i < world.map.features.length; i += 1)
      if (bushAt(world, content, i)) tiles.push(i);
    BUSHES.set(world.map, tiles);
  }
  return tiles;
}

/** The unpicked bushes within reach of the store, nearest first (ties by tile), kept for the
 * tick: everyone looking for a bush in a tick asks the same question. A pick drops it. Never
 * saved, and made the same way whenever it is asked, so a loaded world chooses as the running
 * one did. */
const NEAR = new WeakMap<object, { tick: number; ox: number; oy: number; list: number[] }>();
function nearBushes(world: WorldState, content: EngineContent, ox: number, oy: number): number[] {
  const kept = NEAR.get(world);
  if (kept && kept.tick === world.tick && kept.ox === ox && kept.oy === oy) return kept.list;
  const map = world.map;
  const reach = content.work.forage.reach;
  const regrow = content.work.forage.regrowDays * TICKS_PER_DAY;
  const picked = new Map<number, number>();
  for (const b of world.entities['bush'] ?? [])
    picked.set((b['y'] as number) * map.width + (b['x'] as number), b['picked'] as number);
  const near: [number, number][] = [];
  for (const i of bushesOf(world, content)) {
    const d = Math.max(Math.abs((i % map.width) - ox), Math.abs(Math.floor(i / map.width) - oy));
    const at = picked.get(i);
    if (d > reach || (at !== undefined && world.tick - at < regrow)) continue;
    near.push([d, i]);
  }
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const list = near.map(([, i]) => i);
  NEAR.set(world, { tick: world.tick, ox, oy, list });
  return list;
}

/** The ripe bush nearest the store that `p` can get beside, none taken by someone else. */
function chooseBush(ctx: SystemContext, p: EntityRow): number | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const first = storeOf(world)[0];
  const [ox, oy] = first ? [first['x'] as number, first['y'] as number] : [map.startX, map.startY];
  if (!inSeason(world, content)) return undefined;
  const list = nearBushes(world, content, ox, oy);
  if (!list.length) return undefined;
  const taken = busy(world, p, 'forage');
  const from = reachFrom(content, map, spotOf(p));
  for (const i of list) if (!taken.has(i) && besideReachable(world, content, from, i)) return i;
  return undefined;
}

/** Foraging is wanted when food (plus the berries others are walking to) is under its level. */
function foodShort(ctx: SystemContext, p: EntityRow): { have: number; want: number } | undefined {
  const { world, content } = ctx;
  const good = content.work.forage.good;
  const want = wantOf(world, content, good);
  const have = haveOf(world, content, good);
  let coming = 0;
  for (const q of people(world))
    if (q.id !== p.id && q['job'] === 'forage' && (q['target'] as number) >= 0)
      coming += bushAt(world, content, q['target'] as number)?.amount ?? 0;
  return have + coming < want ? { have, want } : undefined;
}

const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.work.forage.job)?.skill ?? '';

/** Takes up foraging, if food is short and nobody who puts it higher can take the bush. */
export function takeUpForaging(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const def = content.work.forage;
  if (!inSeason(world, content)) return false;
  const short = foodShort(ctx, p);
  if (!short || !able(content, p, def.job)) return false;
  if (outranked(ctx, p, def.job, (q) => chooseBush(ctx, q) !== undefined)) return false;
  const bush = chooseBush(ctx, p);
  if (bush === undefined || !goBeside(ctx, p, bush % map.width, Math.floor(bush / map.width)))
    return false;
  if (p['job'] !== 'forage') {
    const stock = content.work.stock.find((s) => s.good === def.good);
    p['took'] = ctx.emit('work.tookUp', {
      causes: [
        ...[
          stockOf(world, def.good)?.['line'] as number | undefined,
          priorityLine(world, p.id, def.job),
        ].filter((l): l is number => l !== undefined),
      ],
      actors: [p.id],
      data: {
        name: p['name'] as string,
        work: 'foraging',
        good: stock?.name ?? def.good,
        ...short,
      },
    });
  }
  const level = skillOf(world, p, skillName(content));
  p['job'] = 'forage';
  p['target'] = bush;
  p['work'] = Math.ceil((def.minutes * 2 * def.skilled) / (def.skilled + level));
  return true;
}

/** One minute at the bush they are foraging: walk beside it, work, pick. False when the bush is
 * gone or cannot be reached (the target is cleared and they look for work again). */
export function foraging(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const target = p['target'] as number;
  const bush = bushAt(world, content, target);
  if (bush) {
    const [x, y] = [target % map.width, Math.floor(target / map.width)];
    const here = spotOf(p);
    if (here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1) {
      p['work'] = (p['work'] as number) - 1;
      practise(ctx, p, skillName(content), p['took'] as number);
      if ((p['work'] as number) <= 0) {
        pick(ctx, p, target, x, y);
        p['target'] = -1;
      }
      return true;
    }
    if (goBeside(ctx, p, x, y)) return true;
  }
  p['target'] = -1;
  return false;
}

/** The berries are picked: the bush is marked picked, the berries lie around it, one line. */
function pick(ctx: SystemContext, p: EntityRow, i: number, x: number, y: number): void {
  const { world, content } = ctx;
  const def = bushAt(world, content, i);
  if (!def) return;
  const item = content.items.find((it) => it.id === def.yields)?.name ?? def.yields!;
  const line = ctx.emit('work.picked', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, count: def.amount, what: item, x, y },
  });
  NEAR.delete(world);
  const row = pickedRow(world, x, y);
  if (row) Object.assign(row, { picked: world.tick, line });
  else addEntity(world, 'bush', { x, y, picked: world.tick, line });
  tallyAdd(ctx, 'picked', layAround(ctx, def.yields!, def.amount, { x, y, z: 0 }, line));
}
