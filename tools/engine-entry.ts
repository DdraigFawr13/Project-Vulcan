// What the map and budget tools use from the engine, gathered for tools/engine.mjs.
export {
  addEntity,
  createSim,
  createWorld,
  isFrozen,
  makeRegion,
  removeEntity,
  step,
  submitCommand,
  SYSTEMS,
  TICKS_PER_DAY,
  WATER,
} from '../src/engine/index.ts';
export { strandedWater, waterNearStart } from '../src/engine/map/checks.ts';
export { reachableAround } from '../src/engine/map/features.ts';
export { MAP_SEEDS } from '../src/engine/map/seeds.ts';
export { makeLevel } from '../src/engine/map/underground.ts';
export { canReach, findPath, walkAt } from '../src/engine/paths/index.ts';
export { content } from '../src/content/index.ts';
export { growSpot } from '../src/engine/goods/index.ts';
