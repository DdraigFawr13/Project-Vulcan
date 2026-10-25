// Shape of Vulcan's flock file (src/content/data/flock.json, Phase 5 Bundle 3, P5.4b): the
// pasture the colony sites, the tame flock's year (taming, lambing, shearing, the cull) and hay.
// Minutes are game minutes, chances shares of 1, distances tiles; hay counts one head's day.
import { bool, list, map, num, obj, ref, str } from './schema';
import { count, id, share, text, texts } from './schema-fields';

const side = num({ min: 1 });

export const FLOCK_SCHEMAS = {
  flock: obj({
    // The Build sheet's Pasture row (start level `start`): `w` by `h` tiles inside and including
    // the hurdles, a `fold` by `fold` fold in the corner nearest the green and a `meadow` beside
    // it; sited within `reach` of the green and `water` of water, scored by `weigh`.
    pasture: obj({
      name: text,
      start: num({ min: 1 }),
      holds: num({ min: 1 }),
      w: side,
      h: side,
      fold: side,
      meadow: obj({ w: side, h: side }),
      reach: side,
      water: side,
      weigh: obj({ water: count, herd: count, near: count, trees: count, tries: num({ min: 1 }) }),
      hurdle: str(),
      gate: str(),
    }),
    job: ref('jobs'),
    // Young are taken in the `young` months, a grown animal in the other grazing `months`.
    tame: obj({
      species: texts,
      young: texts,
      months: texts,
      youngMinutes: num({ min: 1 }),
      adultMinutes: num({ min: 1 }),
      session: num({ min: 1 }),
      reach: side,
      crew: count,
      fed: num({ min: 0 }),
      back: num({ min: 0 }),
    }),
    kinds: list(
      obj({
        species: id,
        female: str(),
        male: str(),
        young: str(),
        femaleName: text,
        maleName: text,
        youngName: text,
        fleece: bool(),
      }),
    ),
    lambing: obj({
      month: str(),
      chance: share,
      dies: share,
      diesWithin: num({ min: 1 }),
      grown: str(),
    }),
    shear: obj({
      month: str(),
      minutes: num({ min: 1 }),
      item: ref('items'),
      count: num({ min: 1 }),
    }),
    hay: obj({
      months: texts,
      perTile: num({ min: 1 }),
      mow: num({ min: 1 }),
      carry: num({ min: 1 }),
      dry: num({ min: 1 }),
      spoil: share,
      plan: num({ min: 1 }),
      thaw: str(),
    }),
    cull: obj({
      month: str(),
      minutes: num({ min: 1 }),
      ramsPer: num({ min: 1 }),
      item: ref('items'),
    }),
    fold: obj({ before: count, minutes: num({ min: 1 }), open: count, wait: count }),
    move: obj({ every: num({ min: 1 }), wander: num({ min: 1 }) }),
    memories: obj({ cull: str(), taken: str() }),
    why: map(text),
  }),
};
