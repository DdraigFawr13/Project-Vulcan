// Hearths (P3.6, V-041, V-049, V-050): colonists decide where fires go. The first is the campfire
// on the green, planned in the first hour on the nearest free open tile; after that a built room
// gets one only when someone is in it while it is under `rooms.hearthBelow` without a fire
// (V-068), sited by the hearth kind's `place` hint (wants.ts). A planned hearth is
// a furniture piece in state `plan`; builders make it where it stands (people/hearth.ts).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { inStore, itemsAt, raiseStock } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { furnitureOf } from './furniture.ts';
import { planAt } from './plans.ts';
import { housesOf, rectOf } from './site.ts';
import { tileTemperature } from '../weather/index.ts';
import { roomName, siteFor } from './wants.ts';
import { roomAt } from './rooms.ts';
import { stationAt } from './station.ts';

export const HEARTH = 'hearth';
/** How far from the green the campfire may be set. */
const SEARCH = 6;

/** Open ground for the campfire: buildable, dry, clear, off the store and every house. */
export function openGround(
  world: WorldState,
  content: EngineContent,
  x: number,
  y: number,
): boolean {
  const map = world.map;
  if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return false;
  const i = y * map.width + x;
  const kind = content.terrain.kinds[map.tiles[i]!]!;
  if (!kind.buildable || kind.water || kind.solid || map.built[i] || map.features[i]) return false;
  if (planAt(world, x, y) || inStore(world, x, y, 0) || itemsAt(world, x, y, 0).length)
    return false;
  if (stationAt(world, x, y)) return false;
  if (furnitureOf(world).some((f) => f['x'] === x && f['y'] === y && f['z'] === 0)) return false;
  const pad = (h: EntityRow) => {
    const r = rectOf(h);
    return x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;
  };
  return !housesOf(world).some(pad);
}

/** A hearth plan, with its line and the stone it will need. */
function plan(ctx: SystemContext, at: { x: number; y: number; facing: string }, line: number) {
  const { world, content } = ctx;
  addEntity(world, 'furniture', {
    ...{ kind: HEARTH, x: at.x, y: at.y, z: 0, facing: at.facing, quality: 0, maker: 0 },
    ...{ owner: 0, made: 0, line, state: 'plan', have: 0, work: -1, waited: 0 },
  });
  const material = content.buildings.furniture.kinds.find((k) => k.id === HEARTH)!.material;
  raiseStock(ctx, material ?? content.buildings.furniture.material, HEARTH, line);
}

/** No hearth on or beside the green: plan the campfire on the nearest free tile to it. */
export function planCampfire(ctx: SystemContext, g: Spot): void {
  const { world, content } = ctx;
  const near = (f: EntityRow) =>
    Math.max(Math.abs((f['x'] as number) - g.x), Math.abs((f['y'] as number) - g.y)) <= SEARCH;
  if (furnitureOf(world).some((f) => f['kind'] === HEARTH && near(f))) return;
  for (let r = 0; r <= SEARCH; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const [x, y] = [g.x + dx, g.y + dy];
        if (!openGround(world, content, x, y) || !canReach(content, world.map, g, { x, y, z: 0 }))
          continue;
        const line = ctx.emit('fire.planned', {
          causes: [world.begunEvent],
          data: { what: 'campfire', where: 'on the green', why: 'the band has no fire' },
        });
        plan(ctx, { x, y, facing: 's' }, line);
        return;
      }
}

/** A used room with no hearth, planned or built, whose unheated temperature is under
 * `rooms.hearthBelow` gets one planned, citing the cold person's line (else the weather spell).
 * Once planned it stays. Checked each hour, only for houses someone is standing in. */
export function planRoomHearths(ctx: SystemContext): void {
  const { world, content } = ctx;
  const width = world.map.width;
  const below = content.buildings.rooms.hearthBelow;
  const folk = (world.entities['person'] ?? []).filter(
    (p) => p['status'] === 'alive' && p['z'] === 0,
  );
  for (const h of housesOf(world)) {
    if (h['state'] !== 'built') continue;
    const r = rectOf(h);
    const inside = folk.filter(
      (p) =>
        (p['x'] as number) > r.x &&
        (p['x'] as number) < r.x + r.w - 1 &&
        (p['y'] as number) > r.y &&
        (p['y'] as number) < r.y + r.h - 1,
    );
    if (!inside.length) continue;
    const room = roomAt(world, content, r.x + 1, r.y + 1);
    if (!room) continue;
    const tiles = new Set(room.tiles);
    const at = (e: EntityRow) => tiles.has((e['y'] as number) * width + (e['x'] as number));
    if (furnitureOf(world).some((f) => f['kind'] === HEARTH && f['z'] === 0 && at(f))) continue;
    const here = inside.filter(at);
    const temp = tileTemperature(
      content,
      world.map,
      world.systems['weather']?.['temp'] ?? 0,
      room.tiles[0]!,
    );
    if (!here.length || temp >= below) continue;
    const rr = { h, room };
    const site = siteFor(world, content, rr, HEARTH);
    const who = here[0]!;
    const cold = (world.entities['need'] ?? []).find(
      (n) => n['person'] === who.id && n['need'] === 'warmth',
    );
    const cause = cold?.['low']
      ? (cold['line'] as number)
      : (world.systems['weather']?.['spell'] as number) || world.begunEvent;
    if (!site) {
      // Said once for the room, so the cold has a reason on the alert line.
      h['cold'] ||= ctx.emit('fire.noFloor', {
        causes: [cause].filter((c) => c > 0),
        actors: [who.id],
        data: { name: who['name'] as string, room: roomName(world, content, h) },
      });
      continue;
    }
    const line = ctx.emit('fire.plannedCold', {
      causes: [cause].filter((c) => c > 0),
      actors: [who.id],
      data: { name: who['name'] as string, room: roomName(world, content, h) },
    });
    plan(ctx, site, line);
  }
}
