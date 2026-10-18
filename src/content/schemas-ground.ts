// Shapes of Vulcan's own ground files in src/content/data: what grows or lies on a tile.
import { bool, list, map, num, obj, oneOf, opt, range, ref, str } from './schema';
import { count, id, share, text } from './schema-fields';

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
      // per 10,000 tiles of `size` tiles, `near` of them within the start radius, placed in
      // solid rock with `rocks` weighting the rock kinds it prefers (1 for any other).
      vein: opt(
        obj({
          level: num({ min: 1 }),
          per10k: count,
          size: range(),
          near: count,
          rocks: map(count, 'terrain'),
        }),
      ),
    }),
  ),
};
