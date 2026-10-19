// Heat from fires (P3.6, V-043): a lit fire gives its fuel's `heat` degrees at its own tile and
// `fire.fall` fewer for each tile of distance, over the closed room it stands in or, in the open,
// out to `fire.radius` tiles. Banked, it gives the fuel's `banked.heat`. A tile takes the most
// any one fire gives it (no adding). Nothing is stored in the world: the map of the whole
// surface is worked out when asked and kept for the tick it was asked in (a cache that is never
// saved and always rebuilt from the same rows, so a replay and a loaded save agree).
import type { EngineContent, WorldState } from '../core/index.ts';
import { firesOf, fuelOf, pieceOfFire, reachOf } from './fire.ts';

const cache = new WeakMap<WorldState, { key: string; heat: ReadonlyMap<number, number> }>();
const NONE: ReadonlyMap<number, number> = new Map();

/** Whole degrees a lit fire adds at each surface tile that has any. */
export function heatMap(world: WorldState, content: EngineContent): ReadonlyMap<number, number> {
  const lit = firesOf(world).filter((f) => f['lit']);
  if (!lit.length) return NONE;
  // Any change to the world's rows (a wall built, a fire lit or out) writes a line, so the next
  // line id and which fires are lit and banked are the whole key.
  const key = `${world.nextEventId}:${lit.map((f) => `${f.id}${f['banked']}`).join()}`;
  const hit = cache.get(world);
  if (hit?.key === key) return hit.heat;
  const width = world.map.width;
  const { fall } = content.work.fire;
  const heat = new Map<number, number>();
  for (const f of lit) {
    const fuel = fuelOf(content, f['kind'] as string);
    if (!fuel) continue;
    const piece = pieceOfFire(world, f);
    const [hx, hy] = [piece['x'] as number, piece['y'] as number];
    const top = f['banked'] ? fuel.banked.heat : fuel.heat;
    for (const i of reachOf(world, content, piece)) {
      const d = Math.max(Math.abs((i % width) - hx), Math.abs(Math.floor(i / width) - hy));
      const give = top - fall * d;
      if (give > (heat.get(i) ?? 0)) heat.set(i, give);
    }
  }
  cache.set(world, { key, heat });
  return heat;
}

/** Whole degrees the lit fires add at surface tile `i`. */
export const heatAt = (world: WorldState, content: EngineContent, i: number): number =>
  heatMap(world, content).get(i) ?? 0;
