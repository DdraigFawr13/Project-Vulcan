// The flock on the move (P5.4b): every `move.every` minutes a kept animal with a way takes a step;
// every `move.wander` minutes one inside its place steps to a neighbouring tile of it, and one outside
// it (just tamed, or let out or shut in) is given a way there.
import type { EntityRow } from '../core/index.ts';
import { findPath, stepCost } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { flocksOf, keptOf, placeTiles } from './flock.ts';

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  ...([
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ] as const),
];

/** One step to a neighbouring tile, on the people's terms (`stepCost`): a ford the way crosses is
 * waded, a hurdle is not passed, a gate is. False when the step cannot be taken now. */
function stepTo(ctx: SystemContext, a: EntityRow, to: number): boolean {
  const { content, world } = ctx;
  const map = world.map;
  const [ox, oy] = [a['x'] as number, a['y'] as number];
  if (stepCost(content, map, oy * map.width + ox, to) === 0) return false;
  const x = to % map.width;
  a['facing'] = x > ox ? 'e' : x < ox ? 'w' : a['facing']!;
  a['stride'] = 1 - (a['stride'] as number);
  [a['x'], a['y']] = [x, Math.floor(to / map.width)];
  return true;
}

/** One minute of the flock's walking. */
export function moveFlocks(ctx: SystemContext): void {
  const { world, content } = ctx;
  const mv = content.flock.move;
  if (world.tick % mv.every !== 0) return;
  const wander = world.tick % mv.wander === 0;
  const w = world.map.width;
  for (const flock of flocksOf(world)) {
    const animals = keptOf(world, flock);
    if (!animals.length) continue;
    const place = placeTiles(world, flock);
    const inside = new Set(place);
    for (const a of animals) {
      const path = a['path'] as number[];
      const here = (a['y'] as number) * w + (a['x'] as number);
      if (path.length) {
        if (stepTo(ctx, a, path[0]!)) path.shift();
        else a['path'] = [];
      } else if (wander && !inside.has(here)) {
        const goal = ctx.rng().pick(place);
        const way = findPath(
          content,
          world.map,
          { x: a['x'] as number, y: a['y'] as number, z: 0 },
          { x: goal % w, y: Math.floor(goal / w), z: 0 },
        );
        if (way) a['path'] = way;
      } else if (wander) {
        const open = NEIGHBOURS.map(
          ([dx, dy]) => [(a['x'] as number) + dx, (a['y'] as number) + dy] as const,
        )
          .map(([x, y]) => y * w + x)
          .filter((t) => inside.has(t));
        if (open.length) stepTo(ctx, a, ctx.rng().pick(open));
      }
    }
  }
}
