// The engine's one public surface. The engine is pure: same seed, content and commands, same
// ledger, tick for tick (DECISIONS V-002, V-006). The worker is the only place it is run.
import { calendarSystem } from './calendar/index.ts';
import { goodsSystem } from './goods/index.ts';
import { mapSystem } from './map/index.ts';
import { needsSystem } from './needs/index.ts';
import { peopleSystem } from './people/index.ts';
import { regionSystem } from './region/index.ts';
import { weatherSystem } from './weather/index.ts';
import type { EngineContent } from './core/index.ts';
import { createSim as createSimWith, type Sim, type System } from './sim/index.ts';

export * from './core/index.ts';
export * from './log/index.ts';
export * from './entity/index.ts';
export { createWorld, replay, step, submitCommand } from './sim/index.ts';
export type { Cadence, Sim, System, SystemContext } from './sim/index.ts';
export { calendarSystem } from './calendar/index.ts';
export {
  freeTile,
  goodsSystem,
  haveOf,
  inStore,
  isTree,
  itemsAt,
  itemsOf,
  marksOf,
  stockOf,
  storeOf,
  wantOf,
} from './goods/index.ts';
export { moodOf, needOf, needsSystem } from './needs/index.ts';
export { drawBand, peopleSystem, PEOPLE_TABLES, tradeOf } from './people/index.ts';
export type { Home, Person } from './people/index.ts';
export { makeRegion, regionSystem, siteOf, valleyOf } from './region/index.ts';
export type { Region, RegionNeighbour, RegionSite, RegionValley } from './region/index.ts';
export { isFrozen, tileTemperature, weatherSystem, weatherWords } from './weather/index.ts';
export {
  auraAt,
  CHUNK,
  chunksAcross,
  chunksDown,
  chunkTiles,
  layerOf,
  mapSystem,
  setTile,
} from './map/index.ts';

/** The game's systems in tick order. Later milestones add theirs here. */
export const SYSTEMS: readonly System[] = [
  regionSystem,
  mapSystem,
  peopleSystem,
  goodsSystem,
  needsSystem,
  calendarSystem,
  weatherSystem,
];

/** A simulation over `content` with the game's systems, or the given ones (tests add fixtures). */
export const createSim = (
  content: EngineContent,
  systems: readonly System[] = SYSTEMS,
  recentDays?: number,
): Sim => createSimWith(content, systems, recentDays);
