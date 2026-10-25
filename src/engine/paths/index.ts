// Public surface of the paths module (P2.3): ways across the valley and the levels below.
export { costAt, pack, stepCost, unpack, walkAt } from './grid.ts';
export type { Node, Spot } from './grid.ts';
export { besideReachable } from './beside.ts';
export { canReach, findPath, reachFrom } from './search.ts';
