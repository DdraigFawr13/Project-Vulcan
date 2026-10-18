// What the map tools use from the engine, gathered for tools/engine.mjs.
export {
  createSim,
  createWorld,
  isFrozen,
  makeRegion,
  step,
  TICKS_PER_DAY,
  WATER,
} from '../src/engine/index.ts';
export { strandedWater, waterNearStart } from '../src/engine/map/checks.ts';
export { reachableAround } from '../src/engine/map/features.ts';
export { MAP_SEEDS } from '../src/engine/map/seeds.ts';
export { makeLevel } from '../src/engine/map/underground.ts';
