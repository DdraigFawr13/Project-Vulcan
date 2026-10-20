// The pack at the town's edge (V-110): at `pack.visit` days without a meal, between `night.from`
// and `night.to` o'clock, the pack walks from its den towards the nearest lure (a midden piece the
// goods side lays with `setLures`), else the town ring's edge, at most every `visitEvery` days;
// it goes home at dawn. The first of them to arrive writes `wild.packAtEdge`. Attacks on people
// are the people's side (`markAttack`).
import { TICKS_PER_DAY } from '../core/index.ts';
import { greenOf, ringOf } from '../build/index.ts';
import { findPath } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { distance, openNear } from './ground.ts';
import { animalsOf, packOf } from './wild.ts';

/** Where the goods side says the pack would go instead of the ring's edge (state `lures` and
 * `lure1`...: map indices plus one); an empty list, the default, clears them. */
export function setLures(ctx: SystemContext, tiles: readonly number[]): void {
  const state = ctx.world.systems['wild']!;
  for (let k = 1; k <= (state['lures'] ?? 0); k += 1) delete state[`lure${k}`];
  tiles.forEach((t, k) => (state[`lure${k + 1}`] = t + 1));
  state['lures'] = tiles.length;
}

/** The tile the pack walks to and how a line names it: the lure nearest the den, else the ring's edge. */
function target(ctx: SystemContext, den: { x: number; y: number }): { i: number; where: string } {
  const { world, content, state } = ctx;
  const map = world.map;
  const words = content.wild.pack.where;
  let best = -1;
  let far = Infinity;
  for (let k = 1; k <= (state['lures'] ?? 0); k += 1) {
    const t = state[`lure${k}`]! - 1;
    const d = distance(den.x, den.y, t % map.width, Math.floor(t / map.width));
    if (d < far) [best, far] = [t, d];
  }
  if (best >= 0) return { i: best, where: words.midden };
  // The ring's edge on the line from the green to the den.
  const green = greenOf(world);
  const [dx, dy] = [den.x - green.x, den.y - green.y];
  const m = Math.max(1, Math.abs(dx), Math.abs(dy));
  const ring = Math.min(ringOf(world, content), m);
  const [x, y] = [green.x + Math.trunc((dx * ring) / m), green.y + Math.trunc((dy * ring) / m)];
  const at = openNear(content, map, x, y, 6) ?? green.y * map.width + green.x;
  return { i: at, where: words.edge };
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
    const way = findPath(
      content,
      map,
      { x: a['x'] as number, y: a['y'] as number, z: 0 },
      { x: spot % map.width, y: Math.floor(spot / map.width), z: 0 },
    );
    if (way) Object.assign(a, { path: way, state: '' });
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
    sendAll(ctx, target(ctx, den).i);
  } else if (hour === dials.night.to && pack['visiting']) {
    pack['visiting'] = 0;
    sendAll(ctx, den.y * world.map.width + den.x);
  }
}

/** The first pack animal has reached the edge (or the midden): the line, once a visit. */
export function arrived(ctx: SystemContext): void {
  const pack = packOf(ctx.world);
  if (!pack || pack['shown']) return;
  const den = { x: pack['denX'] as number, y: pack['denY'] as number };
  const line = ctx.emit('wild.packAtEdge', {
    causes: [(pack['hungryLine'] as number) || (pack['line'] as number)],
    data: {
      name: pack['name'] as string,
      where: target(ctx, den).where,
      days: pack['hunger'] as number,
    },
  });
  Object.assign(pack, { shown: 1, line });
}
