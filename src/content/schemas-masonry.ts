// Shapes of roofs and the building trades (6B Bundle 3, P6.11; `buildings`, spread into
// schemas-life.ts). What each dial does: core/masonry.ts.
import { list, num, obj, ref } from './schema';
import { count, text } from './schema-fields';

export const MASONRY_SCHEMAS = {
  roofs: obj({
    job: ref('jobs'),
    skilled: num({ min: 1 }),
    thatch: obj({
      name: text,
      per: num({ min: 1 }),
      cut: num({ min: 1 }),
      lay: num({ min: 1 }),
      reach: num({ min: 1 }),
      wears: num({ min: 1 }),
      worn: count,
    }),
    reed: list(text),
    straw: obj({ per: num({ min: 1 }), crops: list(text) }),
    open: count,
  }),
  masonry: obj({
    reach: num({ min: 1 }),
    mason: obj({
      job: ref('jobs'),
      skilled: num({ min: 1 }),
      dress: obj({ stone: num({ min: 1 }), minutes: num({ min: 1 }) }),
      split: obj({
        rock: text,
        near: num({ min: 1 }),
        slate: num({ min: 1 }),
        stone: count,
        minutes: num({ min: 1 }),
      }),
      slate: obj({ per: num({ min: 1 }), lay: num({ min: 1 }) }),
      wall: obj({ minutes: num({ min: 1 }) }),
    }),
    lime: obj({
      job: ref('jobs'),
      skilled: num({ min: 1 }),
      kiln: text,
      rock: text,
      near: num({ min: 1 }),
      break: obj({ limestone: num({ min: 1 }), stone: count, minutes: num({ min: 1 }) }),
      burn: obj({
        limestone: num({ min: 1 }),
        fuel: num({ min: 1 }),
        lime: num({ min: 1 }),
        minutes: num({ min: 1 }),
      }),
    }),
    stages: obj({
      stone: obj({
        name: text,
        burned: num({ min: 1 }),
        from: list(text),
        lime: text,
        clay: text,
        dry: text,
        dryAfter: num({ min: 1 }),
      }),
      slate: obj({ name: text }),
      wash: obj({
        name: text,
        from: text,
        to: text,
        per: num({ min: 1 }),
        minutes: num({ min: 1 }),
      }),
    }),
  }),
};
