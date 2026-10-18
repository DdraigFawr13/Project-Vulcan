// Public surface of the paths module (P2.3): ways across the valley and the levels below.
export { pack, stepCost, unpack, walkAt } from './grid.ts';
export type { Node, Spot } from './grid.ts';
export { canReach, findPath } from './search.ts';
