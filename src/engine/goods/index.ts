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
  addGranary,
  granaryFor,
  granaryGrowSpot,
  granaryOf,
  GRANARY_TABLES,
  granarySlot,
  growGranary,
  inGranary,
  keepable,
  storedEnough,
} from './granary.ts';
export {
  dryAt,
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
  betterTool,
  freeTools,
  heldBy,
  HELD,
  isWorn,
  layTool,
  lifeFor,
  memoTools,
  restOf,
  speedOf,
  toolOf,
  toolsChanged,
  wornAsk,
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
