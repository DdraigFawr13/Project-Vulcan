// Public surface of the worker layer: the message protocol and a way to start the worker.
import type { ToWorker } from './protocol.ts';
export { SPEEDS, TICKS_PER_SECOND } from './protocol-time.ts';
// Every view type of the protocol files, passed on whole: a new view needs no line here.
export type * from './protocol.ts';
export type * from './protocol-asks.ts';
export type * from './protocol-build.ts';
export type * from './protocol-colony.ts';
export type * from './protocol-flock.ts';
export type * from './protocol-goods.ts';
export type * from './protocol-land.ts';
export type * from './protocol-law.ts';
export type * from './protocol-people.ts';
export type * from './protocol-region.ts';
export type * from './protocol-time.ts';
export type * from './protocol-wild.ts';
// Small words and sums the page shares with the engine, from its pure core only.
export { list, roughDistance } from '../engine/core/index.ts';
export { SAVE_VERSION } from './save.ts';
export type { SaveFile } from './save.ts';

/** Starts the simulation worker, told first whether the page is in test mode: it refuses the test
 * tools unless it is (V-041). The caller terminates it when the page or scene goes away. */
export function spawnSimWorker(testMode: boolean): Worker {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: 'simulation',
  });
  worker.postMessage({ type: 'testMode', on: testMode } satisfies ToWorker);
  return worker;
}
