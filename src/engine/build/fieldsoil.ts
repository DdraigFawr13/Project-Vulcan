// Field soil and the rotation (Phase 5B Bundle 2, V-130): pure reads. A tile's fertility
// (`map.fertility`) is its soil; the dials are content `buildings.field.soil` and `rotation`. The
// lines that change soil are soillife.ts; sowing and reaping are people/farm.ts.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';

/** The mean fertility of a field's tiles (whole). */
export function meanSoil(world: WorldState, f: EntityRow): number {
  const tiles = f['tiles'] as number[];
  if (!tiles.length) return 0;
  return Math.round(tiles.reduce((n, i) => n + world.map.fertility[i]!, 0) / tiles.length);
}

/** What one reaped tile yields: the crop's yield x min(`most`, `base` + soil) / 100, rounded. */
export function yieldAt(
  world: WorldState,
  content: EngineContent,
  cropYield: number,
  tile: number,
) {
  const { base, most } = content.buildings.field.soil;
  return Math.round((cropYield * Math.min(most, base + world.map.fertility[tile]!)) / 100);
}

/** The crop a field takes this month: its course's, or the next course's when the course's
 * window is missed; `at` is the course index sown (the field's course becomes the one after). */
export function courseNow(content: EngineContent, f: EntityRow, month: string) {
  const { rotation, crops } = content.buildings.field;
  for (const k of [0, 1]) {
    const at = ((f['course'] as number) + k) % rotation.length;
    const crop = crops.find((c) => c.id === rotation[at]);
    if (crop?.sow.includes(month)) return { crop, at };
  }
  return undefined;
}
