// Public surface of the worker layer: the message protocol and a way to start the worker.
export { TICKS_PER_SECOND } from './protocol.ts';
export type {
  ChunkView,
  ClockView,
  FromWorker,
  LedgerLine,
  Speed,
  TileView,
  ToWorker,
} from './protocol.ts';
export { SAVE_VERSION } from './save.ts';
export type { SaveFile } from './save.ts';

/** Starts the simulation worker. The caller terminates it when the page or scene goes away. */
export const spawnSimWorker = (): Worker =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'simulation' });
