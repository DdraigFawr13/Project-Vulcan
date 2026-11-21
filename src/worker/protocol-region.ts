// The region map and the picker's valleys as the page gets them (P1.5, P1.6).
import type { RegionSite, RegionValley } from '../engine/index.ts';

/** The region map as the page draws it (engine `Region` less its cells). */
export interface RegionView {
  seed: string;
  width: number;
  height: number;
  /** Only the ranges written on the map, at their label cell. */
  ranges: { name: string; x: number; y: number }[];
  rivers: { name: string; path: (readonly [number, number])[] }[];
  sites: RegionSite[];
  valleys: RegionValley[];
  /** The fields `scale` times per cell: biome index into content biomes, height 0 to 255. */
  raster: { scale: number; width: number; height: number; biome: Uint8Array; height8: Uint8Array };
}

/** A valley on offer in the picker: the map its seed makes, in brief, with a thumbnail. */
export interface ValleyPreview {
  id: number;
  temperature: number;
  rainfall: number;
  /** The two commonest biomes with their shares, e.g. "grassland 44%". */
  biomes: string[];
  lakes: number;
  springs: number;
  /** The schools of its surface aura spots, by name. */
  aura: string[];
  /** Surface ground as terrain indices, biome indices, 1 where a tree stands, 1 under snow. */
  thumb: {
    width: number;
    height: number;
    tiles: Uint8Array;
    biomes: Uint8Array;
    trees: Uint8Array;
    snow: Uint8Array;
  };
}
