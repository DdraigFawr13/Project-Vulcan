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
};
