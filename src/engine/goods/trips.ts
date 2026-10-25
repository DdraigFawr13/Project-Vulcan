// Where goods are carried (5B Bundle 1, V-129): the colony remembers, for the last days, where
// loads were picked up off the ground (gathered: people/haul.ts) and where a carried load was used
// up by someone not hauling it (used: `takeFrom`, at the user's tile, a hearth, a plan, the
// smelter). Counted in TRIP_CELL-tile squares, one count a load, by item kind, a day a slot
// (`buildings.stores.days`); build/stores.ts reads it to site stores where they save walking.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';

/** The side of the squares trips are counted in, in tiles. */
export const TRIP_CELL = 4;
/** The most days a trip is kept (content `stores.days` is at most this). */
const SLOTS = 28;

export const TRIP_TABLES: Schemas = {
  /** Loads of `kind` gathered (`use` 0) or used (`use` 1) in the square centred on x, y: one count
   * a day, the day's slot being the day number modulo the slots. */
  trip: { kind: 'text', use: 'int', x: 'int', y: 'int', n: 'ints' },
};

export const tripsOf = (world: WorldState): EntityRow[] => world.entities['trip'] ?? [];

const centre = (v: number) => Math.floor(v / TRIP_CELL) * TRIP_CELL + (TRIP_CELL >> 1);
const slotOf = (world: WorldState) => Math.floor(world.tick / TICKS_PER_DAY) % SLOTS;

/** One load of `kind` gathered at, or used at, a tile. */
export function noteTrip(world: WorldState, kind: string, x: number, y: number, use: 0 | 1): void {
  const [cx, cy] = [centre(x), centre(y)];
  let row = tripsOf(world).find(
    (t) => t['kind'] === kind && t['use'] === use && t['x'] === cx && t['y'] === cy,
  );
  if (!row) {
    addEntity(world, 'trip', { kind, use, x: cx, y: cy, n: Array<number>(SLOTS).fill(0) });
    row = tripsOf(world).at(-1)!;
  }
  (row['n'] as unknown as number[])[slotOf(world)]! += 1;
}

/** At the start of each day: today's slot starts empty, and squares with nothing left go. */
export function rollTrips(world: WorldState): void {
  const slot = slotOf(world);
  for (const t of [...tripsOf(world)]) {
    const n = t['n'] as unknown as number[];
    n[slot] = 0;
    if (n.every((v) => v === 0)) removeEntity(world, 'trip', t.id);
  }
}

/** The loads of the given kinds over the last `days` days, by square: gathered and used. */
export function tripsFor(
  world: WorldState,
  content: EngineContent,
  kinds: readonly string[],
): {
  gathered: { x: number; y: number; n: number }[];
  used: { x: number; y: number; n: number }[];
} {
  const days = Math.min(content.buildings.stores.days, SLOTS);
  const today = slotOf(world);
  const out = { gathered: new Map<string, number>(), used: new Map<string, number>() };
  for (const t of tripsOf(world)) {
    if (!kinds.includes(t['kind'] as string)) continue;
    const n = t['n'] as unknown as number[];
    let sum = 0;
    for (let d = 0; d < days; d += 1) sum += n[(today - d + SLOTS) % SLOTS]!;
    if (!sum) continue;
    const m = t['use'] ? out.used : out.gathered;
    const key = `${t['x']},${t['y']}`;
    m.set(key, (m.get(key) ?? 0) + sum);
  }
  const list = (m: Map<string, number>) =>
    [...m].map(([k, n]) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x!, y: y!, n };
    });
  return { gathered: list(out.gathered), used: list(out.used) };
}

/** A carried load used up by someone not hauling it counts as used where they stand. */
export function noteUse(world: WorldState, item: EntityRow): void {
  const by = item['holder'] as number;
  if (!by || (item['x'] as number) < 0) return;
  const p = (world.entities['person'] ?? []).find((r) => r.id === by);
  if (!p || p['job'] === 'haul' || p['z'] !== 0) return;
  noteTrip(world, item['kind'] as string, p['x'] as number, p['y'] as number, 1);
}
