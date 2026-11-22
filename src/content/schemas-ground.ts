// Shapes of Vulcan's own ground files in src/content/data: what grows or lies on a tile.
import { bool, list, map, num, obj, oneOf, opt, range, ref, str } from './schema';
import { count, id, share, text } from './schema-fields';

// Terrain generator dials for how rich the valley is (src/engine/map/riches.ts): each good in
// `goods` (features yielding `yields`, or every ore vein) draws a level by weight; the first level
// is poor, the last rich, and every valley has at least one of each, named in words on arrival.
// `regrow`: a felled tree grows back after `years` if a living tree stands within `near` tiles.
// `start.thin`: the green keeps at most `trees` trees within `reach` (fell reach) of the start.
export const VALLEY_DIALS = {
  riches: obj({
    levels: list(obj({ share: num({ min: 0 }), weight: count })),
    goods: list(
      obj({ id, yields: opt(list(ref('items'))), veins: opt(bool()), rich: text, poor: text }),
    ),
  }),
  regrow: obj({ years: num({ min: 1 }), near: num({ min: 1 }) }),
};

export const GROUND_SCHEMAS = {
  // Vulcan's own: what grows or lies on a tile (src/engine/map/features.ts). `density` is the
  // chance a tile of that biome holds it; trees cluster in groves; `nearRock` adds boulders below
  // rock faces.
  features: list(
    obj({
      id,
      name: text,
      kind: oneOf('tree', 'bush', 'herb', 'log', 'boulder', 'vein'),
      art: str(),
      yields: ref('items'),
      amount: count,
      blocks: opt(bool()),
      clumps: opt(bool()),
      glades: opt(bool()),
      density: map(share, 'biomes'),
      nearRock: opt(obj({ reach: count, density: share })),
      // Ore in the rock of one level below (src/engine/map/underground.ts): `per10k` clusters
      // per 10,000 tiles of `size` tiles (times the valley's ore riches), none within the start
      // radius, placed in solid rock with `rocks` weighting the rock kinds it prefers (1 for any other).
      vein: opt(
        obj({
          level: num({ min: 1 }),
          per10k: count,
          size: range(),
          rocks: map(count, 'terrain'),
          // A coloured stain on the surface above the vein (V-087).
          stain: opt(bool()),
          stainColour: opt(str()),
          stainWord: opt(str()),
        }),
      ),
    }),
  ),
};
