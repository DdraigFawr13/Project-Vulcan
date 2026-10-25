// Footfall (P5.10, V-054): each step a person takes onto open surface ground adds one wear to the
// tile; each day (at midnight) each tile loses its wear shifted right by `wear.fade`, so a way walked N times
// a day settles near N << fade and one left alone fades away. The stage a tile has reached
// (`worn`, past each of `wear.stages`) is kept beside it, and its chunk's version is raised only
// when that stage changes, so the screen hears of a path, not of every step. Wear is counted on
// any open ground; the screen shows it only on the kinds that wear (`wear.kinds`). No ledger
// line: steps walked are state (V-036).
import type { EngineContent, MapState } from '../core/index.ts';
import { raiseChunk } from './tiles.ts';

/** The stage `wear` has reached: 0, or how many of `wear.stages` it is at or past. */
export function wearStage(content: EngineContent, wear: number): number {
  let stage = 0;
  for (const at of content.terrain.wear.stages) if (wear >= at) stage += 1;
  return stage;
}

/** About how many times a day a tile is walked, from its settled wear. */
export const walksADay = (content: EngineContent, wear: number): number =>
  Math.round(wear / (1 << content.terrain.wear.fade));

function restage(content: EngineContent, map: MapState, i: number): void {
  const stage = wearStage(content, map.wear[i]!);
  if (stage === map.worn[i]) return;
  map.worn[i] = stage;
  raiseChunk(map, i % map.width, Math.floor(i / map.width));
}

/** A person stepped onto surface tile `i`. */
export function tread(content: EngineContent, map: MapState, i: number): void {
  if (map.wear[i]! < 0xffff) map.wear[i]! += 1;
  restage(content, map, i);
}

/** Each day: every tile forgets its share of wear. */
export function fadeWear(content: EngineContent, map: MapState): void {
  const fade = content.terrain.wear.fade;
  for (let i = 0; i < map.wear.length; i += 1) {
    const wear = map.wear[i]!;
    if (!wear) continue;
    map.wear[i] = wear - Math.max(1, wear >> fade);
    restage(content, map, i);
  }
}
