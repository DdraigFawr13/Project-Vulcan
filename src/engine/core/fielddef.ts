// What colonists lay out as fields: crops, soil and the rotation (P4.7, Phase 5B Bundle 2).

/** A crop (P4.7): sown in the named months, ripe `days` days later, lost to a frost under `frost`. */
export interface CropDef {
  id: string;
  name: string;
  item: string;
  sow: readonly string[];
  days: number;
  yield: number;
  frost: number;
  /** Soil taken from each reaped tile (fertility points); a negative draw gives soil back. */
  draw: number;
}

/** What colonists lay out as fields (P4.7, V-051, V-089). */
export interface FieldDef {
  name: string;
  /** The item sown, one a tile (P4.7). */
  seed: string;
  /** Siting: a block's score weights (`near` is per tile past the ring's edge), and how many of
   * the best are tried for a way in (fieldsite.ts). */
  weigh: { fertility: number; water: number; near: number; tries: number };
  start: number;
  perMouth: number;
  reach: number;
  water: number;
  good: number;
  least: number;
  crops: readonly CropDef[];
  /** The courses a field takes in turn, crop ids (a crop may come twice). */
  rotation: readonly string[];
  /** Soil (Phase 5B Bundle 2, V-130): a tile's yield is the crop's x min(`most`, `base` + its
   * fertility) / 100; a field whose mean fertility is under `rest` rests a sowing window; on the
   * first day of `winter.month` every field tile gains `winter.gain`; on the first day of
   * `muck.month` the colony has `muck.fold` loads of muck for each animal kept in a pasture and
   * `muck.midden` for each midden, each worth `muck.gain` fertility on one tile. */
  soil: {
    base: number;
    most: number;
    rest: number;
    winter: { month: string; gain: number };
    muck: { month: string; gain: number; midden: number; fold: number };
  };
}
