// Straw from the reaping (6B Bundle 3, P6.11): a field of a `roofs.straw.crops` crop gives one
// bundle of straw for every `roofs.straw.per` of its tiles each harvest, kept by the field
// (`straw`) until thatchers take it (roofs.ts).
import type { EngineContent, EntityRow } from '../core/index.ts';

/** Straw bundles one harvest of field `f` gives. */
export const strawOf = (content: EngineContent, f: EntityRow): number =>
  Math.floor((f['tiles'] as number[]).length / content.buildings.roofs.straw.per);
