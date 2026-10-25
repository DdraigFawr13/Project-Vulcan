// Shapes of the town's ground: the ring, the granary and the roads (`buildings`, spread into
// schemas-life.ts), and walking and footfall (`terrain`, spread into schemas-world.ts).
import { list, num, obj, ref } from './schema';
import { text, texts } from './schema-fields';

export const TOWN_SCHEMAS = {
  town: obj({ ring: num({ min: 1 }), step: num({ min: 1 }), most: num({ min: 1 }) }),
  // The granary the band lays out beside a field once it is reaped: `width` by `height` tiles at
  // first, growing to `most` tiles when full. It keeps the harvest the store's Food plate leaves.
  granary: obj({ width: num({ min: 1 }), height: num({ min: 1 }), most: num({ min: 1 }) }),
  // P5.2 (V-131): the well. Over the last `days` days, once `from` have passed, a mean of more than
  // `walk` minutes a person a day spent walking to drink (or the water most drunk from frozen)
  // plans one well of furniture kind `kind` within `near` tiles of the first hearth.
  well: obj({
    kind: text,
    walk: num({ min: 1 }),
    days: num({ min: 1 }),
    from: num({ min: 1 }),
    near: num({ min: 1 }),
  }),
  // P5.10 (V-054, V-124): the Roads row (start level `start`). One stretch at a time of `part`,
  // planned once the store holds its material spare: on the way between two of the colony's
  // places (up to `places` of them) with the most wear not yet under road, its run of at most
  // `stretch` tiles in a row (at least `shortest`), each worn to `least` or more, with the most
  // wear.
  roads: obj({
    name: text,
    start: num({ min: 1, max: 4 }),
    part: text,
    stretch: num({ min: 1 }),
    least: num({ min: 1 }),
    shortest: num({ min: 1 }),
    places: num({ min: 2 }),
  }),
};

export const WALK_SCHEMAS = {
  // P2.3: stride per tick and step costs, in tenths of a straight step (src/engine/paths).
  walking: obj({
    speed: num({ min: 1 }),
    straight: num({ min: 1 }),
    diagonal: num({ min: 1 }),
    stairs: num({ min: 1 }),
    shaft: num({ min: 1 }),
    ice: num({ min: 1 }),
    // P5.10: a step on a road, in tenths of the step on plain ground.
    road: num({ min: 1, max: 10 }),
  }),
  // P5.10 (V-054): footfall. Each step a person takes onto open surface ground adds one wear;
  // every dawn a tile loses its wear shifted right by `fade` (a 64th at 6), so a way walked N
  // times a day settles near N << fade. Wear past each of `stages` shows (words for the
  // inspector) on the ground `kinds` that wear; on others it is only counted.
  wear: obj({
    fade: num({ min: 1, max: 12 }),
    stages: list(num({ min: 1 })),
    words: texts,
    kinds: list(ref('terrain')),
  }),
};
