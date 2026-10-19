// What the colony wants of a metal (V-086): its ingot Stock plate's level less the ingots held.
// Miners (and, from Bundle 3, the smelter and alloying) read the want only through this.
import type { EngineContent, WorldState } from '../core/index.ts';
import { haveOf, wantOf } from './store.ts';

/** Ingots of `metal` (a feature id: iron, copper, tin) the colony still wants; never below 0. */
export function ingotWant(world: WorldState, content: EngineContent, metal: string): number {
  const ingot = `${metal}-ingot`;
  return Math.max(0, wantOf(world, content, ingot) - haveOf(world, content, ingot));
}
