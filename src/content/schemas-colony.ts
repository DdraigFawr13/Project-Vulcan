// Shape of Vulcan's colony file (src/content/data/colony.json, P6.6, V-158, V-159): the colony's
// standing and its causes, the elder, factions and their petitions, and the mood word's causes.
import { list, map, num, obj } from './schema';
import { count, text } from './schema-fields';

// A cause of standing: `by` points for `days` days, in words.
const cause = { by: num(), days: num({ min: 1 }), text };

export const COLONY_SCHEMAS = {
  colony: obj({
    hour: num({ min: 0, max: 23 }),
    standing: obj({
      // Standing starts at `start` (0 to 100); each `per` points from it lean every answer a point.
      start: num({ min: 0, max: 100 }),
      per: num({ min: 1 }),
      words: list(obj({ word: text, at: count })),
      trusts: text,
      distrusts: text,
      // A winter with at most `most` hungry days a person.
      fedWinter: obj({ ...cause, most: count }),
      // Every `every` days that `share` per cent of the answers keep their laws.
      kept: obj({ ...cause, every: num({ min: 1 }), share: num({ min: 0, max: 100 }) }),
      // Every `every` days a setting with `harsh` (laws.json) stands in winter or a short store.
      harsh: obj({ days: num({ min: 1 }), every: num({ min: 1 }), text }),
      answered: obj(cause),
      stood: obj(cause),
      ignored: obj(cause),
      elderDied: obj(cause),
    }),
    // The elder: whoever most villagers trust, each through their own eyes (`vote`), from `least`
    // points (weighed every `every` days); their answer leans friends' (those they shared a tale or a house with in
    // `friendDays`) by `sway`.
    elder: obj({
      every: num({ min: 1 }),
      least: count,
      sway: count,
      friendDays: num({ min: 1 }),
      founder: count,
      listener: count,
      listeners: count,
      keeps: count,
      traits: map(num(), 'traits'),
      roles: map(num()),
      follows: text,
      sides: text,
      vote: obj({
        least: num({ min: 1 }),
        friend: count,
        shared: count,
        plight: count,
        plights: map(text),
        afraid: list(text),
        incumbent: count,
        drop: count,
        looks: text,
        fallen: text,
      }),
    }),
    // A faction: at least `least` people and `share` per cent of the colony each `strong` points
    // short of keeping one law; its members' answers lean `lean` more against it.
    faction: obj({
      least: num({ min: 2 }),
      share: num({ min: 0, max: 100 }),
      strong: count,
      lean: count,
      stands: text,
    }),
    petition: obj({ days: num({ min: 1 }) }),
    mood: obj({ causes: num({ min: 1 }) }),
  }),
};
