// Public surface of the goods system.
export { goodsSystem } from './system.ts';
export { GOODS_TABLES, itemsAt, itemsOf, layItem, stackSize, takeFrom } from './stacks.ts';
export {
  growStore,
  haveOf,
  inStore,
  slotFor,
  stockOf,
  storeOf,
  STORE_TABLES,
  wantOf,
} from './store.ts';
