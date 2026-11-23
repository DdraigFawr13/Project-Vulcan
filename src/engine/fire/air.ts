// Room air (6B, P6.10, amends V-043): a closed room's air holds heat, kept on the fire row that
// warms it (`air`, tenths of a degree above the weather), so a room cools slowly after its fire
// dies. Each hour a lit fire moves the air `fire.air.rise` per mille of the way to its heat
// (banked heat when banked), then the air leaks the room's `leakOf` per mille of itself, at least
// a tenth while any is left. A fire in the open has no air: it warms only while it burns (heat.ts).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { mortaredTiles, roofLeak, roomAt } from '../build/index.ts';
import { firesOf, fuelOf, pieceOfFire } from './fire.ts';

/** Per mille of its heat a room's air loses an hour: the mean of its edge parts' `leak`
 * (work.json `fire.air`), a gap or an unlisted part counting `open`, plus its roof's (build
 * `roofLeak`, 6B); 0 for no room. */
export function leakOf(world: WorldState, content: EngineContent, piece: EntityRow): number {
  const room = roomAt(world, content, piece['x'] as number, piece['y'] as number);
  if (!room) return 0;
  const { width, height } = world.map;
  const inside = new Set(room.tiles);
  const edge = new Set<number>();
  for (const i of room.tiles) {
    const [x, y] = [i % width, Math.floor(i / width)];
    const next: [number, number][] = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of next) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (!inside.has(n)) edge.add(n);
    }
  }
  if (!edge.size) return 0;
  const sum = edgeLeak(world, content, edge);
  const roof = roofLeak(world, content, piece['x'] as number, piece['y'] as number);
  return Math.max(1, Math.floor(sum / edge.size) + roof);
}

/** The sum of the leaks of the edge parts' tiles: a stone wall set by a knower of lime mortar
 * loses `by` per cent less heat (V-219). */
function edgeLeak(world: WorldState, content: EngineContent, edge: Set<number>): number {
  const { leak, open } = content.work.fire.air;
  const lime = content.methods.methods.find((m) => m.id === 'lime-mortar')?.effect ?? { by: 0 };
  const mortared = mortaredTiles(world);
  let sum = 0;
  for (const n of edge) {
    const part = content.buildings.parts[world.map.built[n]! - 1];
    const one = (part && leak[part.id]) ?? open;
    const eased = mortared.has(n) && lime.on?.includes(part?.material ?? '');
    sum += eased ? Math.floor((one * (100 - lime.by)) / 100) : one;
  }
  return sum;
}

/** The heat (tenths of a degree) a fire drives its room's air towards now. */
function driveOf(content: EngineContent, f: EntityRow): number {
  const fuel = f['lit'] ? fuelOf(content, f['kind'] as string) : undefined;
  if (!fuel) return 0;
  return 10 * (f['banked'] ? fuel.banked.heat : fuel.heat);
}

/** One hour of room air for every fire: warmed while lit, leaking always; none outside a room. */
export function airHour(world: WorldState, content: EngineContent): void {
  const { rise } = content.work.fire.air;
  for (const f of firesOf(world)) {
    const piece = pieceOfFire(world, f);
    const leak = piece ? leakOf(world, content, piece) : 0;
    if (!leak) {
      f['air'] = 0;
      continue;
    }
    let air = (f['air'] as number | undefined) ?? 0;
    const drive = driveOf(content, f);
    if (drive > air) air += Math.floor(((drive - air) * rise) / 1000);
    if (air > 0) air -= Math.max(1, Math.floor((air * leak) / 1000));
    f['air'] = Math.max(0, air);
  }
}

/** Whole degrees a fire's room air adds (its `air` in tenths). */
export const airOf = (f: EntityRow): number => Math.floor(((f['air'] as number) ?? 0) / 10);
