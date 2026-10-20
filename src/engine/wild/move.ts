// Animals on the move (V-110): every `move.every` minutes a resting animal may set out for a
// point within its range and steps along the way; a person within the species' flee distance sets
// it running (state `flee`) for `move.fleeFor` minutes, a step every `move.fleeEvery`. Animals
// never enter water, rock or a built wall (the paths module's rules). Each step may leave a print.
import type { EngineContent, EntityRow, RngStream } from '../core/index.ts';
import { findPath, stepCost } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { distance, openAt } from './ground.ts';
import { dirOf, leavePrint } from './prints.ts';
import { arrived } from './visit.ts';
import { animalsOf, herdsOf, packRow, speciesOf } from './wild.ts';

const printCache = new WeakMap<EngineContent, Map<string, string>>();

/** The print id of an art kind's feet. */
function printOf(content: EngineContent, kind: string): string {
  let table = printCache.get(content);
  if (!table) {
    table = new Map();
    for (const s of content.wild.species) for (const k of s.kinds) table.set(k, s.print);
    for (const p of content.wild.predators) table.set(p.kind, p.print);
    printCache.set(content, table);
  }
  return table.get(kind)!;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  ...([
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const),
  ...([
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ] as const),
];

/** Moves `a` onto tile `to`, a neighbour, if it may go there; leaves its print. */
function stepTo(ctx: SystemContext, a: EntityRow, to: number): boolean {
  const { content, world } = ctx;
  const map = world.map;
  const [ox, oy] = [a['x'] as number, a['y'] as number];
  if (!openAt(content, map, to) || stepCost(content, map, oy * map.width + ox, to) === 0)
    return false;
  const [x, y] = [to % map.width, Math.floor(to / map.width)];
  a['facing'] = x > ox ? 'e' : x < ox ? 'w' : a['facing']!;
  a['stride'] = 1 - (a['stride'] as number);
  [a['x'], a['y']] = [x, y];
  leavePrint(ctx, to, printOf(content, a['kind'] as string), dirOf(x - ox, y - oy));
  return true;
}

/** Moves a pack animal one step nearer (x, y) when a neighbouring tile is closer and open; true if
 * it moved (the prowl of a hungry pack, people/fight.ts). */
export function approach(ctx: SystemContext, a: EntityRow, x: number, y: number): boolean {
  const map = ctx.world.map;
  const [ax, ay] = [a['x'] as number, a['y'] as number];
  const gap = (px: number, py: number): number => (px - x) * (px - x) + (py - y) * (py - y);
  let [best, far] = [-1, gap(ax, ay)];
  for (const [dx, dy] of NEIGHBOURS) {
    const [tx, ty] = [ax + dx, ay + dy];
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
    if (gap(tx, ty) < far) [best, far] = [ty * map.width + tx, gap(tx, ty)];
  }
  return best >= 0 && stepTo(ctx, a, best);
}

/** One minute of the wild valley's animals: flight steps, then a resting walk on each `every`. */
export function moveAnimals(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const mv = content.wild.move;
  const walkers = world.tick % mv.every === 0;
  const runners = state['fleeing']! > 0 && world.tick % mv.fleeEvery === 0;
  const trotters = state['trot']! > 0 && world.tick % mv.trot === 0;
  if (!walkers && !runners && !trotters) return;
  const alive = (world.entities['person'] ?? []).filter(
    (p) => p['status'] === 'alive' && p['z'] === 0,
  );
  const at = (p: EntityRow) => [p['x'] as number, p['y'] as number] as const;
  // A hunter stalking does not frighten a herd: it is scared when the stalk fails (`scareHerd`).
  const folk = alive.map(at);
  const scary = alive.filter((p) => p['job'] !== content.work.hunt.job).map(at);
  if (runners) run(ctx, folk);
  if (trotters) trot(ctx);
  if (walkers) walk(ctx, scary);
  let fleeing = 0;
  for (const a of animalsOf(world)) if (a['state'] === 'flee') fleeing += 1;
  state['fleeing'] = fleeing;
}

/** The nearest person to (x, y) and the squared distance to them, if anyone is about. */
function nearest(folk: readonly (readonly [number, number])[], x: number, y: number) {
  let best: readonly [number, number] | undefined;
  let d2 = Infinity;
  for (const p of folk) {
    const d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
    if (d < d2) [best, d2] = [p, d];
  }
  return best && { at: best, d2 };
}

/** Fleeing animals step to the neighbour farthest from the nearest person, or stop when done. */
function run(ctx: SystemContext, folk: readonly (readonly [number, number])[]): void {
  const { world } = ctx;
  const map = world.map;
  for (const a of animalsOf(world)) {
    if (a['state'] !== 'flee') continue;
    const [x, y] = [a['x'] as number, a['y'] as number];
    const near = nearest(folk, x, y);
    if (world.tick >= (a['until'] as number) || !near) {
      a['state'] = '';
      continue;
    }
    let [best, far] = [-1, near.d2];
    for (const [dx, dy] of NEIGHBOURS) {
      const [tx, ty] = [x + dx, y + dy];
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
      const d = (near.at[0] - tx) * (near.at[0] - tx) + (near.at[1] - ty) * (near.at[1] - ty);
      if (d > far && stepCost(ctx.content, map, y * map.width + x, ty * map.width + tx) > 0)
        [best, far] = [ty * map.width + tx, d];
    }
    if (best >= 0) stepTo(ctx, a, best);
  }
}

/** The pack on the move between its den and the town's edge, at a trot: each animal with a way
 * takes a step; the first to arrive for a visit writes the line. */
function trot(ctx: SystemContext): void {
  const { world, state } = ctx;
  const pack = packRow(world);
  let going = 0;
  for (const a of animalsOf(world)) {
    const path = a['path'] as number[];
    if (!a['pack'] || !path.length) continue;
    if (stepTo(ctx, a, path[0]!)) path.shift();
    else a['path'] = [];
    if (!(a['path'] as number[]).length && pack?.['visiting'] && !pack['shown']) arrived(ctx);
    if ((a['path'] as number[]).length) going += 1;
  }
  state['trot'] = going;
}

/** The resting walk: a frightened animal runs, a walking one takes its next step, a resting one
 * may set out for a point in its range. */
function walk(ctx: SystemContext, folk: readonly (readonly [number, number])[]): void {
  const { world, content } = ctx;
  const mv = content.wild.move;
  const rng = ctx.rng();
  // Per herd: its row, the distance at which it takes fright and the people near enough to matter.
  const herds = new Map(
    herdsOf(world).map((h) => {
      const flee = speciesOf(content, h['species'] as string).flee;
      const reach = (h['radius'] as number) + flee + content.wild.place.spread + 12;
      const near = folk.filter(
        (p) => distance(h['x'] as number, h['y'] as number, p[0], p[1]) <= reach,
      );
      return [h.id, { row: h, flee, near }] as const;
    }),
  );
  const pack = packRow(world);
  for (const a of animalsOf(world)) {
    if (a['state'] === 'flee' || (a['pack'] && ctx.state['trot'])) continue;
    const [x, y] = [a['x'] as number, a['y'] as number];
    const info = herds.get(a['herd'] as number);
    const herd = info?.row;
    if (info?.near.length) {
      const near = nearest(info.near, x, y);
      if (near && distance(x, y, near.at[0], near.at[1]) <= info.flee) {
        Object.assign(a, { state: 'flee', until: world.tick + mv.fleeFor, path: [] });
        continue;
      }
    }
    const path = a['path'] as number[];
    if (path.length) {
      if (stepTo(ctx, a, path[0]!)) path.shift();
      else a['path'] = [];
    } else if (!(a['pack'] && pack?.['visiting'])) {
      setOut(ctx, rng, a, herd, pack);
    }
  }
}

/** A resting animal may take a way to a point in its range (or home, when it has strayed). */
function setOut(
  ctx: SystemContext,
  rng: RngStream,
  a: EntityRow,
  herd: EntityRow | undefined,
  pack: EntityRow | undefined,
): void {
  const { world, content } = ctx;
  const map = world.map;
  if (rng.int(100) >= content.wild.move.wander) return;
  const home = herd
    ? { x: herd['x'] as number, y: herd['y'] as number, r: herd['radius'] as number }
    : { x: pack!['denX'] as number, y: pack!['denY'] as number, r: content.wild.pack.roam };
  const [x, y] = [a['x'] as number, a['y'] as number];
  const tx = Math.max(0, Math.min(map.width - 1, home.x + rng.between(-home.r, home.r)));
  const ty = Math.max(0, Math.min(map.height - 1, home.y + rng.between(-home.r, home.r)));
  if ((tx === x && ty === y) || !openAt(content, map, ty * map.width + tx)) return;
  const reach = content.wild.move.reach;
  // Within its range an animal walks straight at its point and stops where the ground stops it;
  // one that has strayed out of it finds a proper way home (a search, but rare).
  if (distance(x, y, home.x, home.y) <= home.r) {
    a['path'] = lineWay(ctx, [x, y], [tx, ty], reach);
    return;
  }
  const way = findPath(content, map, { x, y, z: 0 }, { x: tx, y: ty, z: 0 });
  if (!way || way.length > reach * 4) return;
  // Water is never entered: the way ends before the first tile that is not open ground.
  const blocked = way.findIndex((n) => !openAt(content, map, n));
  a['path'] = blocked < 0 ? way : way.slice(0, blocked);
}

/** The tiles of a straight walk from `from` towards `to` (diagonal first, then along one axis),
 * at most `limit` of them, ending where a step cannot be taken. */
function lineWay(ctx: SystemContext, from: [number, number], to: [number, number], limit: number) {
  const { world, content } = ctx;
  const map = world.map;
  const out: number[] = [];
  let [x, y] = from;
  while ((x !== to[0] || y !== to[1]) && out.length < limit) {
    const [sx, sy] = [Math.sign(to[0] - x), Math.sign(to[1] - y)];
    const tries =
      sx && sy
        ? [
            [sx, sy],
            [sx, 0],
            [0, sy],
          ]
        : [[sx, sy]];
    const step = tries.find(([dx, dy]) => {
      const i = (y + dy!) * map.width + x + dx!;
      return openAt(content, map, i) && stepCost(content, map, y * map.width + x, i) > 0;
    });
    if (!step) break;
    [x, y] = [x + step[0]!, y + step[1]!];
    out.push(y * map.width + x);
  }
  return out;
}
