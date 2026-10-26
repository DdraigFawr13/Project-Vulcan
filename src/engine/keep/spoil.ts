// Food spoiling (P5.12, V-132): each midnight every food stack lying on a tile loses its item's
// rate (`spoilPerDay`, else `spoilPerMonth` over a 28-day month), times where it lies (open ground,
// the home store, a house floor, a walled store, below ground) and how warm its tile is (the day's
// temperature there plus any fire's heat; below ground a steady `keep.below` degrees, a cellar's
// too, its own store of `below` place). Whole units
// are taken from the stack; the part of a unit left over is kept on the stack (`rot`, in
// millionths) for the next day. Carried food does not spoil. What each store loses is counted and
// said once a week (system.ts).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { depotAt, inHomeStore, itemsOf, takeFrom } from '../goods/index.ts';
import { roomsOf } from '../build/index.ts';
import { heatAt } from '../fire/index.ts';
import { tileTemperature } from '../weather/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addEntity } from '../entity/index.ts';

const MILLION = 1_000_000;
const MONTH = 28;

export type Place = 'open' | 'store' | 'house' | 'walled' | 'below';

/** The item's own loss a day, as a share, or 0 for what does not spoil. */
export function dailyOf(content: EngineContent, kind: string): number {
  const def = content.items.find((i) => i.id === kind);
  if (!def || content.life.eat[kind] === undefined) return 0;
  return def.spoilPerDay ?? (def.spoilPerMonth ?? 0) / MONTH;
}

/** How warmth changes the rate: the first step the temperature is under. */
export function warmthTimes(content: EngineContent, temp: number): number {
  const steps = content.work.keep.warmth;
  return (steps.find((s) => temp < s.under) ?? steps[steps.length - 1]!).times;
}

/** Where a stack lies, for its rate. `floors` is the house floor tiles, worked out once a day. */
export function placeOf(world: WorldState, i: EntityRow, floors: ReadonlySet<number>): Place {
  const [x, y, z] = [i['x'] as number, i['y'] as number, i['z'] as number];
  if (z > 0) return 'below';
  if (depotAt(world, x, y, z)) return 'walled';
  if (inHomeStore(world, x, y, z)) return 'store';
  if (floors.has(y * world.map.width + x)) return 'house';
  return 'open';
}

/** The temperature a stack keeps at: its tile's, with any fire's heat; below ground, steady. */
export function keptAt(world: WorldState, content: EngineContent, i: EntityRow): number {
  if ((i['z'] as number) > 0) return content.work.keep.below;
  const at = (i['y'] as number) * world.map.width + (i['x'] as number);
  const floor = (world.systems['weather']?.['temp'] as number | undefined) ?? 10;
  return tileTemperature(content, world.map, floor, at) + heatAt(world, content, at);
}

/** The barrels on a store tile (cooper.ts), 0 for none. */
export const barrelsAt = (world: WorldState, x: number, y: number, z: number): number =>
  ((world.entities['cask'] ?? []).find((c) => c['x'] === x && c['y'] === y && c['z'] === z)?.[
    'barrels'
  ] as number | undefined) ?? 0;

/** A stack's loss a day as a share, where it lies now. Barrels under it cut the rate of as much
 * of it as `keep.barrel.holds` a barrel covers, to `keep.barrel.times` of it. */
export function rateOf(
  world: WorldState,
  content: EngineContent,
  i: EntityRow,
  floors: ReadonlySet<number>,
): number {
  const base = dailyOf(content, i['kind'] as string);
  if (!base) return 0;
  const place = content.work.keep.place[placeOf(world, i, floors)];
  // A cooked meal is made to be eaten tomorrow: its rate is its own, wherever it lies.
  if (content.items.find((d) => d.id === i['kind'])?.cooked) return base;
  const barrels = barrelsAt(world, i['x'] as number, i['y'] as number, i['z'] as number);
  const { times, holds } = content.work.keep.barrel;
  const covered = barrels ? Math.min(1, (holds * barrels) / (i['count'] as number)) : 0;
  return (
    base * place * warmthTimes(content, keptAt(world, content, i)) * (1 - (1 - times) * covered)
  );
}

/** House floor tiles (rooms of built houses), for `placeOf`. */
export const floorsOf = (world: WorldState, content: EngineContent): Set<number> =>
  new Set(roomsOf(world, content).flatMap((r) => r.room.tiles));

/** The key a loss is counted under: a store of a kind's id, the home store (0) or the open (-1). */
function keyOf(world: WorldState, i: EntityRow, place: Place): number {
  if (place === 'walled' || place === 'below') {
    const d = depotAt(world, i['x'] as number, i['y'] as number, i['z'] as number);
    return d ? d.id : -1;
  }
  return place === 'store' ? 0 : -1;
}

/** One midnight's spoiling over every food stack lying on a tile. */
export function spoilDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  const floors = floorsOf(world, content);
  for (const i of [...itemsOf(world)]) {
    if (i['holder'] || (i['x'] as number) < 0) continue;
    const rate = rateOf(world, content, i, floors);
    if (!rate) continue;
    const owed = Math.round((i['count'] as number) * rate * MILLION) + (i['rot'] as number);
    const whole = Math.floor(owed / MILLION);
    i['rot'] = owed - whole * MILLION;
    if (!whole) continue;
    const kind = i['kind'] as string;
    const made = i['made'] as number;
    const key = keyOf(world, i, placeOf(world, i, floors));
    const lost = takeFrom(world, i, whole);
    noteLoss(world, key, kind, lost, made);
  }
}

/** Adds to this week's count of a kind lost at a store (or the open). */
function noteLoss(world: WorldState, store: number, kind: string, n: number, made: number): void {
  const row = (world.entities['spoilage'] ?? []).find(
    (r) => r['store'] === store && r['kind'] === kind,
  );
  if (row) {
    row['count'] = (row['count'] as number) + n;
    return;
  }
  addEntity(world, 'spoilage', { store, kind, count: n, made });
}
