// Where people sleep (P3.7, P3.8, P5.14): which house a tile is in, whose home a house is, and the
// free floor a bedroll is laid on. A home (P5.14) is a house with an `owner`: its owner and their
// partner sleep there, and nobody else lays a bedroll in it.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { itemsOf } from '../goods/index.ts';
import type { Spot } from '../paths/index.ts';
import { bedOwnedBy, furnitureOf } from './furniture.ts';
import { roomAt } from './rooms.ts';
import { housesOf, inRect, onEdge, rectOf } from './site.ts';

/** The house a row belongs to: itself, or the house a room was added to. */
export const mainOf = (world: WorldState, h: EntityRow): EntityRow =>
  h['of'] ? (housesOf(world).find((o) => o.id === h['of']) ?? h) : h;

/** The rows of a house: the house and the rooms added to it. */
export const rowsOf = (world: WorldState, main: EntityRow): EntityRow[] =>
  housesOf(world).filter((h) => (h.id === main.id || h['of'] === main.id) && h['state'] !== 'sent');

/** The house row whose inside (within its walls) holds tile (x, y), standing or planned. */
export function houseAt(world: WorldState, x: number, y: number): EntityRow | undefined {
  return housesOf(world).find(
    (h) => h['state'] !== 'sent' && inRect(rectOf(h), x, y) && !onEdge(rectOf(h), x, y),
  );
}

const person = (world: WorldState, id: number): EntityRow | undefined =>
  (world.entities['person'] ?? []).find((p) => p.id === id);

/** A person and the partner they came with, living, ids in order. */
export function householdOf(world: WorldState, id: number): number[] {
  const partner = person(world, id)?.['partner'] as number | undefined;
  const mate = partner ? person(world, partner) : undefined;
  return mate && mate['status'] === 'alive' ? [id, partner!].sort((a, b) => a - b) : [id];
}

/** The home of a person's household, planned or built (P5.14), if any. */
export function homeFor(world: WorldState, id: number): EntityRow | undefined {
  const ids = householdOf(world, id);
  return housesOf(world).find(
    (h) => !h['of'] && h['state'] !== 'sent' && ids.includes(h['owner'] as number),
  );
}

/** Their home once it stands. */
export function builtHome(world: WorldState, id: number): EntityRow | undefined {
  const h = homeFor(world, id);
  return h?.['state'] === 'built' ? h : undefined;
}

/** Whether a house (its main row) is someone else's home than person `id`'s. */
export const othersHome = (world: WorldState, main: EntityRow, id: number): boolean =>
  !!main['owner'] && !householdOf(world, id).includes(main['owner'] as number);

/** The built house (main row) a person sleeps in: their bed's, else their laid bedroll's. */
export function sleepsIn(
  world: WorldState,
  content: EngineContent,
  id: number,
): EntityRow | undefined {
  const bed =
    bedOwnedBy(world, id) ??
    itemsOf(world).find(
      (i) =>
        i['owner'] === id &&
        i['kind'] === content.life.cart.bedroll &&
        i['state'] === 'laid' &&
        !i['holder'],
    );
  if (!bed || bed['z'] !== 0) return undefined;
  const h = houseAt(world, bed['x'] as number, bed['y'] as number);
  return h && h['state'] === 'built' ? mainOf(world, h) : undefined;
}

/** A free tile to lay a bedroll on inside a built house: a built floor with nothing on it, in
 * house and tile order. For a bedroll `leaving` a crowded room of a house (rooms.ts), only a
 * tile in another room of that house where one more bed would not crowd it. `reserved` tiles
 * (index) are where others are carrying their bedrolls, and count as laid. For person `who`
 * (P5.14), only their own home once it stands, and never another's home. */
export function bedSpot(
  world: WorldState,
  content: EngineContent,
  leaving?: { x: number; y: number },
  reserved: readonly number[] = [],
  who = 0,
): Spot | undefined {
  const map = world.map;
  const taken = new Set([
    ...itemsOf(world)
      .filter((i) => !i['holder'] && i['z'] === 0)
      .map((i) => (i['y'] as number) * map.width + (i['x'] as number)),
    ...furnitureOf(world)
      .filter((f) => f['z'] === 0)
      .map((f) => (f['y'] as number) * map.width + (f['x'] as number)),
    ...reserved,
  ]);
  const from = leaving && houseAt(world, leaving.x, leaving.y);
  const own = who ? builtHome(world, who) : undefined;
  const home = from && from['state'] === 'built' ? mainOf(world, from) : undefined;
  // Leaving for their own home, not for another room of this house.
  const leavingRoom = own && home && home.id !== own.id ? undefined : home;
  const old = leavingRoom && roomAt(world, content, leaving!.x, leaving!.y);
  const crowd = content.buildings.rooms.crowd.tiles;
  const rows = own
    ? rowsOf(world, own)
    : leavingRoom
      ? rowsOf(world, leavingRoom)
      : housesOf(world);
  for (const h of rows) {
    if (h['state'] !== 'built' || h['sick']) continue;
    if (!own && who && othersHome(world, mainOf(world, h), who)) continue;
    const r = rectOf(h);
    const room = roomAt(world, content, r.x + 1, r.y + 1);
    if (leavingRoom && (!room || room.tiles.includes(old?.tiles[0] ?? -1))) continue;
    // Bedrolls laid in it, and those on their way there.
    const coming = room ? reserved.filter((i) => room.tiles.includes(i)).length : 0;
    if (room && (room.beds + coming + 1) * crowd > room.tiles.length) continue;
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 1)
      for (let x = r.x + 1; x < r.x + r.w - 1; x += 1) {
        const part = content.buildings.parts[map.built[y * map.width + x]! - 1];
        if (part?.kind === 'floor' && !taken.has(y * map.width + x)) return { x, y, z: 0 };
      }
  }
  return undefined;
}
