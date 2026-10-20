// Fishing (P5.4a, V-041): the same shape as foraging, for the water. While food is under its
// Food plate, a free person takes up fishing: the nearest stream, river or lake tile they can get
// beside (never water that is frozen), worked from its bank. Each `every` minutes a catch chance
// by fishing skill gives `count` fish, laid by the angler for haulers. Water that freezes ends the
// day's fishing. Taking up is a ledger line; each catch is not.
import { WATER, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { haveOf, stockOf, storeOf, wantOf } from '../goods/index.ts';
import { besideReachable, reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isFrozen } from '../weather/index.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { busy, goBeside, layAround, people, skillOf, spotOf } from './spots.ts';

const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.work.fish.job)?.skill ?? '';

/** The water tiles of the kinds fished, found once per map (water is set once by the generator). */
const WATERS = new WeakMap<object, number[]>();
function watersOf(world: WorldState, content: EngineContent): number[] {
  let tiles = WATERS.get(world.map);
  if (!tiles) {
    const codes = content.work.fish.water.map((w) => (WATER as readonly string[]).indexOf(w));
    tiles = [];
    for (let i = 0; i < world.map.water.length; i += 1)
      if (codes.includes(world.map.water[i]!)) tiles.push(i);
    WATERS.set(world.map, tiles);
  }
  return tiles;
}

/** The unfrozen water tile nearest `p` within reach of the store that they can get beside. */
function chooseWater(ctx: SystemContext, p: EntityRow): number | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const first = storeOf(world)[0];
  const [ox, oy] = first ? [first['x'] as number, first['y'] as number] : [map.startX, map.startY];
  const here = spotOf(p);
  const taken = busy(world, p, 'fish');
  const near: [number, number][] = [];
  for (const i of watersOf(world, content)) {
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    if (Math.max(Math.abs(x - ox), Math.abs(y - oy)) > content.work.fish.reach) continue;
    if (isFrozen(map, i) || taken.has(i)) continue;
    near.push([Math.max(Math.abs(x - here.x), Math.abs(y - here.y)), i]);
  }
  near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const from = reachFrom(content, map, here);
  for (const [, i] of near.slice(0, 40)) if (besideReachable(world, content, from, i)) return i;
  return undefined;
}

/** Fishing is wanted when food is under its level and fewer than `crew` are already at it. */
function foodShort(ctx: SystemContext, full = false): { have: number; want: number } | undefined {
  const { world, content } = ctx;
  const want = wantOf(world, content, 'food');
  const have = haveOf(world, content, 'food');
  const line = full ? want : Math.floor((want * content.work.fish.from) / 100);
  return have < line ? { have, want } : undefined;
}

const endFishing = (p: EntityRow): false => {
  Object.assign(p, { job: '', target: -1, work: 0 });
  return false;
};

/** Takes up fishing when food is short and there is water to fish and nobody who puts it higher. */
export function takeUpFishing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const def = content.work.fish;
  const short = foodShort(ctx);
  if (!short || !able(content, p, def.job)) return false;
  const crew = people(world).filter((q) => q.id !== p.id && q['job'] === 'fish').length;
  if (crew >= def.crew) return false;
  if (outranked(ctx, p, def.job, (q) => chooseWater(ctx, q) !== undefined)) return false;
  const water = chooseWater(ctx, p);
  if (water === undefined || !goBeside(ctx, p, water % map.width, Math.floor(water / map.width)))
    return false;
  const stock = content.work.stock.find((s) => s.good === 'food');
  p['took'] = ctx.emit('work.tookUpFishing', {
    causes: [
      stockOf(world, 'food')?.['line'] as number | undefined,
      priorityLine(world, p.id, def.job),
    ].filter((l): l is number => l !== undefined),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      water: WATER[map.water[water]!] || 'water',
      good: stock?.name ?? 'food',
      ...short,
    },
  });
  Object.assign(p, { job: 'fish', target: water, work: def.every });
  return true;
}

/** One minute fishing: walk to the bank, then every `every` minutes a catch chance. False when
 * the water has frozen or cannot be reached (they look for work again). */
export function fishing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const def = content.work.fish;
  const target = p['target'] as number;
  if (target < 0 || isFrozen(map, target)) return endFishing(p);
  const [x, y] = [target % map.width, Math.floor(target / map.width)];
  const here = spotOf(p);
  if (here.z !== 0 || Math.abs(here.x - x) + Math.abs(here.y - y) !== 1)
    return goBeside(ctx, p, x, y) || endFishing(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  p['work'] = def.every;
  if (!foodShort(ctx, true)) return endFishing(p);
  const level = skillOf(world, p, skillName(content));
  const chance = Math.min(def.most, def.chance + def.perLevel * level);
  if (ctx.rng().int(100) < chance) {
    const laid = layAround(ctx, 'fish', def.count, here, p['took'] as number);
    ctx.state['fished'] = (ctx.state['fished'] ?? 0) + laid;
  }
  return true;
}
