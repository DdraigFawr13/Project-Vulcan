// Public surface of the goods system.
export { goodsSystem } from './system.ts';
export { GOODS_TABLES, itemsAt, itemsOf, layItem, loadOf, stackSize, takeFrom } from './stacks.ts';
export { storedEnough } from './plates.ts';
export { garmentOf, leftOf, lifeOf, putOn, sparesOf, wornIn, wornOf, worthFor } from './clothes.ts';
export {
  DEPOT_TABLES,
  depotAt,
  depotsFor,
  depotsOf,
  depotTiles,
  insideDepot,
  onDepot,
  storeKindOf,
} from './depots.ts';
export { noteTrip, rollTrips, TRIP_CELL, TRIP_TABLES, tripsFor, tripsOf } from './trips.ts';
export {
  depotSlot,
  dryAt,
  freeTile,
  growSpot,
  growStore,
  haveOf,
  inHomeStore,
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
