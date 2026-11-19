// Where strangers walk in and out (P5.9): the map's edge on their home's side, and the green.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { walkTo } from './walk.ts';

const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
  'north-east': [1, -1],
  'north-west': [-1, -1],
  'south-east': [1, 1],
  'south-west': [-1, 1],
};

function open(world: WorldState, content: EngineContent, x: number, y: number): boolean {
  const map = world.map;
  const i = y * map.width + x;
  const kind = content.terrain.kinds[map.tiles[i]!]!;
  const f = map.features[i]! ? content.features[map.features[i]! - 1] : undefined;
  return !kind.water && !kind.solid && !f?.blocks;
}

/** The open tile on the map's edge nearest where a line from the green toward `dir` meets it,
 * from which the green can be reached. */
export function edgeSpot(world: WorldState, content: EngineContent, dir: string): Spot | undefined {
  const map = world.map;
  const g = greenOf(world);
  const [dx, dy] = STEPS[dir] ?? [0, 1];
  let [x, y] = [g.x, g.y];
  while (x + dx >= 0 && y + dy >= 0 && x + dx < map.width && y + dy < map.height)
    [x, y] = [x + dx, y + dy];
  const edge: [number, number][] = [];
  for (let i = 0; i < map.width; i += 1) edge.push([i, 0], [i, map.height - 1]);
  for (let j = 1; j < map.height - 1; j += 1) edge.push([0, j], [map.width - 1, j]);
  const far = ([a, b]: [number, number]) => Math.max(Math.abs(a - x), Math.abs(b - y));
  edge.sort((a, b) => far(a) - far(b) || a[1] - b[1] || a[0] - b[0]);
  const at = edge.find(
    ([a, b]) => open(world, content, a, b) && canReach(content, map, { x: a, y: b, z: 0 }, g),
  );
  return at && { x: at[0], y: at[1], z: 0 };
}

/** Sets `p` walking to the green, or beside it when it is taken; false when there is no way. */
export function toGreen(ctx: SystemContext, p: EntityRow): boolean {
  const g = greenOf(ctx.world);
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, -1],
  ] as const)
    if (walkTo(ctx, p, { x: g.x + dx!, y: g.y + dy!, z: 0 })) return true;
  return false;
}
