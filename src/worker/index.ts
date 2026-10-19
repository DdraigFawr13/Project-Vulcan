// Public surface of the worker layer: the message protocol and a way to start the worker.
import type { ToWorker } from './protocol.ts';
export { TICKS_PER_SECOND } from './protocol.ts';
export type {
  BuildRow,
  BuildView,
  HouseView,
  PieceView,
  PlanView,
  RoomView,
  ShaftView,
} from './protocol-build.ts';
export type { AnswerView, HoursView, LawView } from './protocol-law.ts';
export type {
  AuraView,
  ChunkView,
  ClockView,
  FromWorker,
  LedgerLine,
  NeedView,
  PersonView,
  WalkerView,
  RegionView,
  Speed,
  YesterdayView,
  TileView,
  TimingView,
  ToWorker,
  ValleyPreview,
  WeatherView,
} from './protocol.ts';
export type { GoodsView, ItemView, StockView } from './protocol-goods.ts';
export { SAVE_VERSION } from './save.ts';
export type { SaveFile } from './save.ts';

/** Starts the simulation worker. The caller terminates it when the page or scene goes away. */
/** The simulation worker, told first whether the page is in test mode: it refuses the test tools
 * unless it is (V-041). */
export function spawnSimWorker(testMode: boolean): Worker {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: 'simulation',
  });
  worker.postMessage({ type: 'testMode', on: testMode } satisfies ToWorker);
  return worker;
}
