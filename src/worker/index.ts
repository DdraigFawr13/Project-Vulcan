// Public surface of the worker layer: the message protocol and a way to start the worker.
export { TICKS_PER_SECOND } from './protocol.ts';
export type {
  BuildRow,
  BuildView,
  HouseView,
  PieceView,
  PlanView,
  RoomView,
} from './protocol-build.ts';
export type {
  AuraView,
  ChunkView,
  ClockView,
  FromWorker,
  GoodsView,
  LedgerLine,
  NeedView,
  PersonView,
  WalkerView,
  RegionView,
  Speed,
  StockView,
  YesterdayView,
  TileView,
  TimingView,
  ToWorker,
  ValleyPreview,
  WeatherView,
} from './protocol.ts';
export { SAVE_VERSION } from './save.ts';
export type { SaveFile } from './save.ts';

/** Starts the simulation worker. The caller terminates it when the page or scene goes away. */
export const spawnSimWorker = (): Worker =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'simulation' });
