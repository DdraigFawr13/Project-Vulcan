// Rooms (P3.3, V-043): a room is worked out when asked, like warmth, and nothing is saved (its
// ground is kept beside the map until anything built changes). It is the ground joined to a tile
// without crossing a wall or a door, closed off on every side and with at least one door in its
// edge; a ring with no door is not a room. Its role, beauty and
// impressiveness come from its tiles and what lies in it, by the weights in content `rooms`.
import type { EngineContent, MapState, WorldState } from '../core/index.ts';
import { builtEpoch } from '../map/index.ts';
import { itemsOf } from '../goods/index.ts';
import { piecesOf, qualityOf } from './furniture.ts';

export interface Room {
  /** Its tiles, as surface tile indices in the order found. */
  tiles: number[];
  doors: number;
  /** Door tile indices in its edge. */
  doorTiles: number[];
  /** Places to sleep: the most of its bed pieces and the people sleeping in it (P3.4). */
  beds: number;
  /** People sleeping in it: bedrolls laid in it, and beds owned (P3.5). */
  sleepers: number;
  /** Built bed pieces in it, free or owned. */
  bedPieces: number;
  /** The first content role it has the beds for, or undefined (a bed makes it a bedroom). */
  role?: { id: string; name: string };
  beauty: number;
  look: string;
  crowded: boolean;
  impressiveness: number;
}

/** The kind of part built on surface tile `i`, if any. */
const builtKind = (world: WorldState, content: EngineContent, i: number) =>
  content.buildings.parts[world.map.built[i]! - 1]?.kind;

/** A room's ground alone, worked out from what is built: its tiles in the order found and its
 * doors, or null where tile `start` is in no room. */
interface Shape {
  tiles: readonly number[];
  doors: readonly number[];
  inside: ReadonlySet<number>;
}

/** Shapes kept per map until anything built changes (`builtEpoch`), by start tile. */
const shapes = new WeakMap<
  MapState,
  { epoch: number; built: Uint8Array; content: EngineContent; by: Map<number, Shape | null> }
>();

function shapeAt(world: WorldState, content: EngineContent, start: number): Shape | null {
  const map = world.map;
  const epoch = builtEpoch(map);
  let kept = shapes.get(map);
  if (!kept || kept.epoch !== epoch || kept.built !== map.built || kept.content !== content)
    shapes.set(map, (kept = { epoch, built: map.built, content, by: new Map() }));
  let shape = kept.by.get(start);
  if (shape === undefined) kept.by.set(start, (shape = flood(world, content, start)));
  return shape;
}

/** The ground joined to `start` without crossing a wall or a door, or null when it reaches the
 * map's edge, passes `rooms.most` tiles or has no door. */
function flood(world: WorldState, content: EngineContent, start: number): Shape | null {
  const map = world.map;
  const shut = (i: number) => {
    const kind = builtKind(world, content, i);
    return kind === 'wall' || kind === 'door';
  };
  if (shut(start)) return null;
  const seen = new Set([start]);
  const tiles = [start];
  const doors: number[] = [];
  for (let k = 0; k < tiles.length; k += 1) {
    const i = tiles[k]!;
    const [tx, ty] = [i % map.width, Math.floor(i / map.width)];
    if (tx === 0 || ty === 0 || tx === map.width - 1 || ty === map.height - 1) return null;
    for (const n of [i - 1, i + 1, i - map.width, i + map.width]) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (builtKind(world, content, n) === 'door') doors.push(n);
      if (shut(n)) continue;
      tiles.push(n);
      if (tiles.length > content.buildings.rooms.most) return null;
    }
  }
  return doors.length ? { tiles, doors, inside: new Set(tiles) } : null;
}

/** The room surface tile (x, y) lies in, or undefined when it is outdoors, a wall or a door. */
export function roomAt(
  world: WorldState,
  content: EngineContent,
  x: number,
  y: number,
): Room | undefined {
  const map = world.map;
  const def = content.buildings.rooms;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  const shape = shapeAt(world, content, y * map.width + x);
  if (!shape) return undefined;
  const tiles = [...shape.tiles];
  const doors = shape.doors;
  const at = (r: { [k: string]: unknown }) =>
    r['z'] === 0 && shape.inside.has((r['y'] as number) * map.width + (r['x'] as number));
  const rolls = itemsOf(world).filter(
    (i) =>
      i['kind'] === content.life.cart.bedroll && i['state'] === 'laid' && !i['holder'] && at(i),
  ).length;
  const pieces = piecesOf(world).filter(at);
  const bedList = pieces.filter((f) => f['kind'] === 'bed');
  const sleepers = rolls + bedList.filter((f) => f['owner']).length;
  const beds = Math.max(bedList.length, sleepers);
  const floors = tiles.reduce((sum, i) => {
    const part = content.buildings.parts[map.built[i]! - 1];
    return sum + (part?.kind === 'floor' ? (def.floors[part.id] ?? 0) : def.bare);
  }, 0);
  const crowded = beds > 0 && beds * def.crowd.tiles > tiles.length;
  const made = pieces.reduce(
    (sum, f) => sum + qualityOf(content, f['quality'] as number).beauty,
    0,
  );
  const beauty = Math.round(floors / tiles.length) + (crowded ? def.crowd.beauty : 0) + made;
  const impressiveness = Math.min(
    def.top,
    Math.max(0, Math.round(tiles.length / def.perSize) + beauty),
  );
  const role = def.roles.find((r) => beds >= r.beds);
  return {
    tiles,
    doors: doors.length,
    doorTiles: [...doors],
    beds,
    sleepers,
    bedPieces: bedList.length,
    ...(role && { role: { id: role.id, name: role.name } }),
    beauty,
    look: def.looks.find((l) => beauty >= l.at)?.word ?? '',
    crowded,
    impressiveness,
  };
}
