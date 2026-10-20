// Prints (V-122): an animal stepping onto ground that holds them leaves one, the kind of its feet,
// the way it was going and when. Ground holds prints while snow lies on it, or on a wet day when
// its terrain is soft; prints older than `wild.printHours` are gone. The layers are on the map
// (`printKind`, `printAt`, `printDir`) and go to the screen in the chunks; a chunk's version is
// raised for new or faded prints at most every `printRedraw` hours, so the worker does not resend
// it every step.
import type { EngineContent, WorldState } from '../core/index.ts';
import { CHUNK, chunksAcross, raiseChunk } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Direction 0 to 7 (n, ne, e, se, s, sw, w, nw) by (dy + 1) * 3 + dx + 1; the middle is unused. */
const DIRS = [7, 0, 1, 6, 0, 2, 5, 4, 3];

export const dirOf = (dx: number, dy: number): number =>
  DIRS[(Math.sign(dy) + 1) * 3 + Math.sign(dx) + 1]!;

/** Whether surface tile `i` takes a print now: snow lies on it, or the day is wet and it is soft. */
export function holdsPrints(world: WorldState, content: EngineContent, i: number): boolean {
  const map = world.map;
  if (map.snowLie[i]) return true;
  if (world.systems['weather']?.['wet'] !== 1) return false;
  return content.wild.soft.includes(content.terrain.kinds[map.tiles[i]!]!.id);
}

/** Lays a print of `print` (a `wild.prints` id) on tile `i`, left by an animal going `dir`. */
export function leavePrint(ctx: SystemContext, i: number, print: string, dir: number): void {
  const { world, content, state } = ctx;
  const map = world.map;
  if (!holdsPrints(world, content, i)) return;
  const kind = content.wild.prints.findIndex((p) => p.id === print);
  map.printKind[i] = kind + 1;
  map.printAt[i] = world.tick;
  map.printDir[i] = dir;
  const x = i % map.width;
  state[
    `dirty${Math.floor((i - x) / map.width / CHUNK) * chunksAcross(map) + Math.floor(x / CHUNK)}`
  ] = 1;
}

/** The print on tile `i`, if one is there and still fresh: its id, name, age in whole hours and
 * direction (0 to 7). */
export function printsAt(
  world: WorldState,
  content: EngineContent,
  i: number,
): { kind: string; name: string; ageHours: number; dir: number } | undefined {
  const map = world.map;
  const kind = map.printKind[i];
  if (!kind) return undefined;
  const age = world.tick - map.printAt[i]!;
  if (age > content.wild.printHours * 60) return undefined;
  const def = content.wild.prints[kind - 1]!;
  return { kind: def.id, name: def.name, ageHours: Math.floor(age / 60), dir: map.printDir[i]! };
}

/** Every `printRedraw` hours, raises the version of every chunk that took or lost a print since. */
export function raiseDirty(ctx: SystemContext): void {
  const { world, state } = ctx;
  const across = chunksAcross(world.map);
  for (const key of Object.keys(state)) {
    if (!key.startsWith('dirty')) continue;
    const c = Number(key.slice(5));
    raiseChunk(world.map, (c % across) * CHUNK, Math.floor(c / across) * CHUNK);
    delete state[key];
  }
}

/** Each midnight, takes the prints older than `printHours` off the ground. */
export function sweepPrints(ctx: SystemContext): void {
  const { world, content } = ctx;
  const map = world.map;
  const limit = content.wild.printHours * 60;
  const across = chunksAcross(map);
  for (let i = 0; i < map.printKind.length; i += 1) {
    if (!map.printKind[i] || world.tick - map.printAt[i]! <= limit) continue;
    map.printKind[i] = 0;
    const x = i % map.width;
    // Redrawn with the next prints (`raiseDirty`), once a chunk however many went.
    ctx.state[`dirty${Math.floor((i - x) / map.width / CHUNK) * across + Math.floor(x / CHUNK)}`] =
      1;
  }
}
