// Rooms (P3.3, V-043): a room is worked out when asked, like warmth, and nothing is stored. It is
// the ground joined to a tile without crossing a wall or a door, closed off on every side and
// with at least one door in its edge; a ring with no door is not a room. Its role, beauty and
// impressiveness come from its tiles and what lies in it, by the weights in content `rooms`.
import type { EngineContent, WorldState } from '../core/index.ts';
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
  const start = y * map.width + x;
  const shut = (i: number) => {
    const kind = builtKind(world, content, i);
    return kind === 'wall' || kind === 'door';
  };
  if (shut(start)) return undefined;
  const seen = new Set([start]);
  const tiles = [start];
  const doors = new Set<number>();
  for (let k = 0; k < tiles.length; k += 1) {
    const i = tiles[k]!;
    const [tx, ty] = [i % map.width, Math.floor(i / map.width)];
    if (tx === 0 || ty === 0 || tx === map.width - 1 || ty === map.height - 1) return undefined;
    for (const n of [i - 1, i + 1, i - map.width, i + map.width]) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (builtKind(world, content, n) === 'door') doors.add(n);
      if (shut(n)) continue;
      tiles.push(n);
      if (tiles.length > def.most) return undefined;
    }
  }
  if (!doors.size) return undefined;
  const inside = new Set(tiles);
  const at = (r: { [k: string]: unknown }) =>
    r['z'] === 0 && inside.has((r['y'] as number) * map.width + (r['x'] as number));
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
    doors: doors.size,
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
