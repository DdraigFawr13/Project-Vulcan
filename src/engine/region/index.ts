// Public surface of the region (P1.5): the lighter world map around the valley.
export { makeRegion } from './region.ts';
export type {
  Region,
  RegionCell,
  RegionNeighbour,
  RegionRange,
  RegionSite,
  RegionValley,
} from './region.ts';
export { regionSystem, siteOf, valleyOf } from './system.ts';
