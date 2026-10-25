// The pack at the town's edge (V-110): at `pack.visit` days without a meal, between `night.from`
// and `night.to` o'clock, the pack walks from its den towards the nearest lure (a midden piece the
// goods side lays with `setLures`), else the town ring's edge, at most every `visitEvery` days;
// it goes home at dawn. The first of them to arrive writes `wild.packAtEdge`. Attacks on people
// are the people's side (`markAttack`).
import { TICKS_PER_DAY, type EngineContent, type WorldState } from '../core/index.ts';
import { greenOf, ringOf } from '../build/index.ts';
import { findPath } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { distance, openNear, whenWord } from './ground.ts';
import { animalsOf, packOf } from './wild.ts';

/** A tile the pack may be drawn to, ranked: the lowest rank is chosen, then the nearest to the den.
 * `where` is a word of `wild.pack.where` (`midden`, `flock`). */
export interface Lure {
  tile: number;
  where: string;
  rank: number;
}

/** State keys of one source's list: `lure_<from>_n` its length, then `lure_<from>_<k>` (tile plus
 * one), `lurew_<from>_<k>` (index of the word) and `lurer_<from>_<k>` (rank), k from 1. */
const LURE_N = /^lure_(.+)_n$/;

/** Replaces `from`'s lures (the goods side's midden pieces, the flock left out) with `lures`; an
 * empty list takes them away. Sources are kept apart, so one never clears another's. */
export function setLures(ctx: SystemContext, from: string, lures: readonly Lure[]): void {
  const { content } = ctx;
  const state = ctx.world.systems['wild']!;
  for (let k = 1; k <= (state[`lure_${from}_n`] ?? 0); k += 1)
    for (const p of ['lure_', 'lurew_', 'lurer_']) delete state[`${p}${from}_${k}`];
  const words = Object.keys(content.wild.pack.where);
  if (lures.some((l) => !words.includes(l.where)))
    throw new Error('A lure names an unknown place.');
  lures.forEach((l, k) => {
    state[`lure_${from}_${k + 1}`] = l.tile + 1;
    state[`lurew_${from}_${k + 1}`] = words.indexOf(l.where);
    state[`lurer_${from}_${k + 1}`] = l.rank;
  });
  if (lures.length) state[`lure_${from}_n`] = lures.length;
  else delete state[`lure_${from}_n`];
}

/** Every lure of every source, in the order of the source's name. */
function luresOf(ctx: SystemContext): Lure[] {
  const { content } = ctx;
  const state = ctx.world.systems['wild']!;
  const words = Object.keys(content.wild.pack.where);
  const out: Lure[] = [];
  const sources = Object.keys(state)
    .flatMap((k) => LURE_N.exec(k)?.[1] ?? [])
    .sort();
  for (const from of sources)
    for (let k = 1; k <= state[`lure_${from}_n`]!; k += 1)
      out.push({
        tile: state[`lure_${from}_${k}`]! - 1,
        where: words[state[`lurew_${from}_${k}`]!]!,
        rank: state[`lurer_${from}_${k}`]!,
      });
  return out;
}

/** The tile the pack walks to and how a line names it: the lowest-ranked lure, the nearest the den
 * of those, else the ring's edge. */
function target(
  ctx: SystemContext,
  den: { x: number; y: number },
): { i: number; where: string; lure: boolean } {
  const { world, content } = ctx;
  const map = world.map;
  let best: Lure | undefined;
  let far = Infinity;
  for (const l of luresOf(ctx)) {
    const d = distance(den.x, den.y, l.tile % map.width, Math.floor(l.tile / map.width));
    if (!best || l.rank < best.rank || (l.rank === best.rank && d < far)) [best, far] = [l, d];
  }
  if (best) return { i: best.tile, where: best.where, lure: true };
  // The ring's edge on the line from the green to the den.
  const green = greenOf(world);
  const [dx, dy] = [den.x - green.x, den.y - green.y];
  const m = Math.max(1, Math.abs(dx), Math.abs(dy));
  const ring = Math.min(ringOf(world, content), m);
  const [x, y] = [green.x + Math.trunc((dx * ring) / m), green.y + Math.trunc((dy * ring) / m)];
  const at = openNear(content, map, x, y, 6) ?? green.y * map.width + green.x;
  return { i: at, where: 'edge', lure: false };
}

/** Sends every pack animal to a free open tile near `goal`, each by its own way. */
function sendAll(ctx: SystemContext, goal: number): void {
  const { world, content } = ctx;
  const map = world.map;
  const taken = new Set<number>();
  for (const a of animalsOf(world)) {
    if (!a['pack']) continue;
    const spot = openNear(
      content,
      map,
      goal % map.width,
      Math.floor(goal / map.width),
      5,
      (i) => !taken.has(i),
    );
    if (spot === undefined) continue;
    taken.add(spot);
    const at = { x: a['x'] as number, y: a['y'] as number, z: 0 };
    const to = (i: number) => ({ x: i % map.width, y: Math.floor(i / map.width), z: 0 });
    // A free tile cut off from the wolf (across a cliff) falls back to the goal itself.
    const sure = findPath(content, map, at, to(spot)) ?? findPath(content, map, at, to(goal));
    if (sure) Object.assign(a, { path: sure, state: '' });
  }
  ctx.state['trot'] = 1;
}

/** On the hour: the night's visit begins, or at dawn ends. */
export function visitOnHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  const pack = packOf(world);
  if (!pack) return;
  const hour = Math.floor((world.tick % TICKS_PER_DAY) / 60);
  const dials = content.wild.pack;
  const den = { x: pack['denX'] as number, y: pack['denY'] as number };
  if (hour === dials.night.from) {
    const rested =
      !pack['visits'] ||
      world.tick - (pack['visitAt'] as number) >= dials.visitEvery * TICKS_PER_DAY;
    if ((pack['hunger'] as number) < dials.visit || !rested || pack['visiting']) return;
    Object.assign(pack, {
      visiting: 1,
      visits: (pack['visits'] as number) + 1,
      visitAt: world.tick,
      shown: 0,
    });
    const goal = target(ctx, den);
    // The goal is kept for the night: lures may come and go before the pack gets there.
    const words = Object.keys(dials.where);
    Object.assign(ctx.state, { goal: goal.i + 1, goalW: words.indexOf(goal.where) });
    ctx.state['goalLure'] = goal.lure ? 1 : 0;
    ctx.state['reached'] = 0;
    sendAll(ctx, goal.i);
  } else if (hour === dials.night.to && pack['visiting']) {
    pack['visiting'] = 0;
    Object.assign(ctx.state, { goal: 0, reached: 0 });
    sendAll(ctx, den.y * world.map.width + den.x);
  }
}

/** After a fight the pack draws off to its den (`wild.packDrewOff`, citing the fight's line). */
export function drawOff(ctx: SystemContext, cause: number): void {
  const pack = packOf(ctx.world);
  if (!pack) return;
  pack['visiting'] = 0;
  Object.assign(ctx.state, { goal: 0, reached: 0 });
  sendAll(ctx, (pack['denY'] as number) * ctx.world.map.width + (pack['denX'] as number));
  pack['line'] = ctx.emit('wild.packDrewOff', {
    causes: [cause],
    data: { name: pack['name'] as string },
  });
}

/** The word a line uses for the visit's goal. */
const phrases = (content: EngineContent): Record<string, string> => content.wild.pack.where;

const goalWord = (ctx: SystemContext): string =>
  Object.keys(ctx.content.wild.pack.where)[ctx.state['goalW'] ?? 0]!;

/** The lure the pack reached on this visit ({tile, where}; `where` the words a line uses for it), set
 * when its first animal arrives and gone at dawn or once the pack has fed; else undefined. */
export function packArrival(
  world: WorldState,
  content: EngineContent,
): { tile: number; where: string } | undefined {
  const state = world.systems['wild']!;
  if (!state['reached'] || !state['goalLure'] || !state['goal']) return undefined;
  const word = Object.keys(content.wild.pack.where)[state['goalW']!]!;
  return { tile: state['goal'] - 1, where: phrases(content)[word]! };
}

/** The pack has eaten (a flock's lamb, say), because of the line `cause`: its hunger is gone and
 * it goes home, ending the visit as dawn does. */
export function feedPack(ctx: SystemContext, cause: number): void {
  const { world } = ctx;
  const pack = packOf(world);
  if (!pack) return;
  Object.assign(pack, { hunger: 0, lastKill: world.tick, visiting: 0 });
  if (cause) pack['line'] = cause;
  Object.assign(ctx.state, { goal: 0, reached: 0 });
  sendAll(ctx, (pack['denY'] as number) * world.map.width + (pack['denX'] as number));
}

/** The first pack animal has reached the edge (or the midden): the line, once a visit. */
export function arrived(ctx: SystemContext): void {
  const pack = packOf(ctx.world);
  if (!pack || pack['shown']) return;
  const line = ctx.emit('wild.packAtEdge', {
    causes: [(pack['hungryLine'] as number) || (pack['line'] as number)],
    data: {
      name: pack['name'] as string,
      where: phrases(ctx.content)[goalWord(ctx)]!,
      when: whenWord(ctx),
      days: pack['hunger'] as number,
    },
  });
  ctx.state['reached'] = 1;
  Object.assign(pack, { shown: 1, line });
}
