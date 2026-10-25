// Shapes of the town's ground: the ring, the stores and the roads (`buildings`, spread into
// schemas-life.ts), and walking and footfall (`terrain`, spread into schemas-world.ts).
import { bool, list, num, obj, opt, ref } from './schema';
import { text, texts } from './schema-fields';

export const TOWN_SCHEMAS = {
  town: obj({ ring: num({ min: 1 }), step: num({ min: 1 }), most: num({ min: 1 }) }),
  // 5B Bundle 1 (V-129): stores by kind, sited from need (build/stores.ts). Carrying is kept for
  // `days` days (goods/trips.ts); a kind gets a store when the best spot within `near` of
  // the green saves `save` tiles of walking a day, or when the home store is full; at most `most`
  // of a kind, a second `apart` tiles or more from the first; the best `tries` spots are tried for
  // ground. Each kind: its goods (and `words` for them), a `w` by `h`
  // footprint of `wall` (none: the house wall rule) with a `door` part (none: a gap) and a
  // `floor`, the words for where its goods come `from` and go `to`, and whether they are `eaten`
  // (food: eating counts as using it at the home store). Food is eaten where it is kept, so a
  // store of an eaten kind stays within `eatenNear` of the green.
  stores: obj({
    days: num({ min: 1 }),
    save: num({ min: 0 }),
    near: num({ min: 1 }),
    eatenNear: num({ min: 1 }),
    most: num({ min: 1 }),
    apart: num({ min: 0 }),
    tries: num({ min: 1 }),
    kinds: list(
      obj({
        id: text,
        name: text,
        words: text,
        goods: list(ref('items')),
        w: num({ min: 3 }),
        h: num({ min: 3 }),
        wall: opt(text),
        door: opt(text),
        floor: opt(text),
        from: text,
        to: text,
        eaten: opt(bool()),
      }),
    ),
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
