// Vulcan's own region file (src/content/data/region.json): the lighter world map around the valley
// (src/engine/region, P1.5). Shares are of the region's 0 to 1 height scale; days are walking days.
import { map, num, obj, range, str } from './schema';
import { count, share, texts } from './schema-fields';

export const REGION_SCHEMAS = {
  region: obj({
    grid: obj({ width: count, height: count }),
    // Value-noise cell sizes (grid cells) for height, its detail and rain; height is
    // (mix - floor) * stretch, clamped to 0..1.
    noise: obj({
      height: count,
      detail: count,
      rain: count,
      detailWeight: share,
      floor: share,
      stretch: num({ min: 0 }),
    }),
    // Degrees C: the north edge's warmth (drawn), the rise to the south edge, and the fall with
    // height above `from`.
    warmth: obj({ north: range(), span: num(), lapse: num(), from: share }),
    // Yearly rain (mm): base, plus up to `span` from noise, plus up to `west` towards the west edge.
    rain: obj({ base: count, span: count, west: count }),
    lake: share,
    mountain: share,
    alpine: share,
    rivers: obj({ count, sources: count, minLength: count, apart: count, twist: num({ min: 1 }) }),
    // Joined mountain cells: at least `min` make a named range; `label` or more are drawn by name.
    ranges: obj({ min: count, label: count }),
    valleys: obj({
      count,
      inset: count,
      spacing: count,
      walls: count,
      reach: count,
      low: range(),
      dry: count,
    }),
    sites: obj({ count: range(), inset: count, spacing: count, near: count }),
    daysPerCell: num({ min: 0 }),
    // What a race's settlement is called (village, hold, warren).
    kinds: map(str(), 'races'),
    // Valley name patterns; {n} is a name from the nearest site's culture.
    vales: texts,
  }),
};
