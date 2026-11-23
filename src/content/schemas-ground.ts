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
  // Known land (6W Slice 4, V-205): a colonist on the surface sees `sight` tiles round them, `high`
  // when standing `height` metres or more above the green; the band knows `arrive` tiles round the
  // green on arrival; a scout's news of at least `least` sources is a find, worked `place` tiles
  // round it however far off.
  known: obj({
    sight: count,
    high: count,
    height: count,
    arrive: count,
    place: count,
    least: count,
  }),
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
          // The colour word of the vein's seam where it shows in a rock face (V-215): a vein with
          // one can be spotted by a prospector; none, it is never looked for.
          seam: opt(str()),
        }),
      ),
    }),
  ),
};

// Scouting (6W Slice 4, V-205), work.json `scout`: see WorkDef.scout in src/engine/core/life.ts.
export const SCOUT = obj({
  job: ref('jobs'),
  reach: count,
  far: count,
  leg: count,
  home: count,
  wait: count,
  traits: list(ref('traits')),
  goods: list(obj({ good: str(), kinds: list(str()), find: text, unit: text })),
  // Trips, camps and their troubles (6W Slice 5, V-206): see WorkDef.scout.
  pack: obj({ over: count, spare: count, most: count, due: count }),
  camp: obj({ fire: num(), heat: count, wood: count, warm: count, pack: count }),
  fall: obj({
    ground: list(str()),
    perHour: count,
    per: count,
    wound: str(),
    parts: list(str()),
    what: text,
  }),
  lost: obj({
    weather: list(str()),
    words: map(text),
    perHour: count,
    per: count,
    days: count,
    wander: count,
  }),
  late: obj({ days: count, memory: ref('memories'), sight: count }),
  // The finds, curios, the season's scout and a newcomer's word (6W Slice 5 part 2, V-206).
  places: obj({
    from: count,
    magic: count,
    magicWords: text,
    kinds: list(
      obj({
        id,
        name: text,
        rule: oneOf('spring', 'grove', 'bank', 'pool', 'lookout', 'cliff', 'seam'),
        size: count,
        gap: count,
        most: count,
        use: opt(oneOf('work', 'clay', 'fish', 'look', 'ore')),
        tale: str(),
        then: text,
      }),
    ),
  }),
  curio: obj({
    far: count,
    per: count,
    list: list(obj({ id, what: text, memory: opt(ref('memories')) })),
  }),
  beyond: obj({ days: count, on: count }),
  word: obj({ wrong: count, lean: count }),
  // Prospecting (6W Slice 7, V-215): see WorkDef.scout.prospect.
  prospect: obj({
    per: count,
    rocks: list(num({ min: 0 })),
    apart: count,
    day: count,
    along: count,
    word: count,
    better: count,
  }),
});
