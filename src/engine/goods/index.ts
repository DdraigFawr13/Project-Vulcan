// Public surface of the goods system.
export { goodsSystem } from './system.ts';
export {
  cloakOf,
  GOODS_TABLES,
  itemsAt,
  itemsOf,
  layItem,
  loadOf,
  stackSize,
  takeFrom,
} from './stacks.ts';
export {
  freeTile,
  growSpot,
  growStore,
  haveOf,
  inStore,
  raiseStock,
  slotFor,
  stockOf,
  storeOf,
  STORE_TABLES,
  wantOf,
} from './store.ts';
export {
  freeTools,
  heldBy,
  HELD,
  isWorn,
  layTool,
  lifeFor,
  nextMaterial,
  restOf,
  speedOf,
  toolOf,
  wornTools,
} from './tools.ts';
export { eatFrom, foodGoneLine } from './food.ts';
export { isTree, markedTree, marksOf, unmark } from './marks.ts';
export {
  charcoalNeeded,
  ingotWant,
  mergeTrails,
  oreTrail,
  plannedRuns,
  trailOf,
  trailText,
  wantedBy,
  withStep,
  type Step,
} from './metal.ts';
