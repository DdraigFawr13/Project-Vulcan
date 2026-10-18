// Vulcan's own region file (src/content/data/region.json): the lighter world map around the valley
// (src/engine/region, P1.5) over the Story Generator's world (P1.6). Shares are of the region's 0 to
// 1 height scale; days are walking days.
import { map, num, obj, range, ref, str } from './schema';
import { count, share, texts } from './schema-fields';

export const REGION_SCHEMAS = {
  region: obj({
    grid: obj({ width: count, height: count }),
    // The Story Generator world behind the region (P1.6, V-031): its size in cells, years of
    // history, the frame of it the region shows (cells across and down), the least share of land
    // in that window, the height in metres drawn as the top of the region's 0 to 1 scale, how far
    // (cells) biome edges are warped so its coarse cells don't show, how many of the best windows are
    // tried for three climates and how far apart (cells) they must be, and the package's old race
    // ids with the Vulcan race each became.
    world: obj({
      size: count,
      years: count,
      frame: range(),
      land: share,
      metres: count,
      warp: num({ min: 0 }),
      tries: count,
      apart: count,
      races: map(ref('races')),
    }),
    // The height share above which ground is mountain (valley walls, the map's peaks).
    mountain: share,
    // At most `count` rivers are drawn, each with at least `minLength` world cells in the window.
    rivers: obj({ count, minLength: count }),
    // A named range is written on the map when it has `label` or more world cells in the window.
    ranges: obj({ label: count }),
    valleys: obj({
      count,
      inset: count,
      spacing: count,
      clear: count,
      walls: count,
      reach: count,
      low: range(),
      dry: count,
    }),
    sites: obj({ count: range(), inset: count, near: count }),
    // A neighbour's history line is its most telling event of at least this importance (1 to 3),
    // passing over lines longer than `length` characters while a shorter one is left.
    history: obj({ importance: count, length: count }),
    daysPerCell: num({ min: 0 }),
    // What a race's settlement is called (village, hold, warren).
    kinds: map(str(), 'races'),
    // Valley name patterns; {n} is a name from the nearest site's culture.
    vales: texts,
    // Patterns for a culture whose tongue has its own word for a valley (Cwm, Glen).
    valesBy: map(texts, 'cultures'),
  }),
};
