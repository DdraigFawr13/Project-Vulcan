// Public surface of the goods system.
export { goodsSystem } from './system.ts';
export { GOODS_TABLES, itemsAt, itemsOf, layItem, stackSize, takeFrom } from './stacks.ts';
export {
  freeTile,
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
export { eatFrom, foodGoneLine } from './food.ts';
export { isTree, markedTree, marksOf, unmark } from './marks.ts';
