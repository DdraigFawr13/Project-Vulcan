// The temperature of one surface tile: the valley floor's, less the terrain's lapse with height.
import type { EngineContent, MapState } from '../core/index.ts';

/** The temperature (whole degrees C) at surface tile `i` when the valley floor is at `floorTemp`. */
export function tileTemperature(
  content: EngineContent,
  map: MapState,
  floorTemp: number,
  i: number,
): number {
  const above = Math.max(0, map.elevation[i]! - map.floor);
  return Math.round(floorTemp - (content.terrain.generator.elevation.lapse * above) / 1000);
}
