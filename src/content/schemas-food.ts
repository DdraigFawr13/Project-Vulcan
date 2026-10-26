// work.json's food sections (P5.3, P5.12): cooking with its recipes and grades, and keeping food.
import { list, num, obj, ref } from './schema';
import { count, id, share, text } from './schema-fields';

// Keeping food (P5.12, V-132): each day a food stack lying on a tile loses its item's
// `spoilPerMonth` (a 28-day month) or `spoilPerDay`, times its `place` (open ground, the home
// store, a house floor, a walled store, below ground) and the first `warmth` step its tile is
// `under` (degrees with any fire's heat; `below` ground it is `below` degrees). Each store's loss
// is one line every `week` days. Food losing at least `haulFirst` a day is carried before other
// loads up to `haulBonus` tiles nearer. `words`: the places' names in the lines.
export const KEEP = obj({
  place: obj({
    open: num({ min: 0 }),
    store: num({ min: 0 }),
    house: num({ min: 0 }),
    walled: num({ min: 0 }),
    below: num({ min: 0 }),
  }),
  warmth: list(obj({ under: num(), times: num({ min: 0 }) })),
  below: num(),
  week: num({ min: 1 }),
  haulFirst: share,
  haulBonus: count,
  words: obj({ open: text, home: text }),
});

// Cooking (V-090): the jobs.json `job`, the `meal` item laid, the `fuel` item burnt (one a
// batch), raw foods in order of preference (`from`), enough of one for `batch` meals at `gain` times
// its food value (rawFor in people/cook.ts) used for them in
// `minutes` at skill `skilled`; meals under `perPerson` for each person make a cook take it up,
// and a meal at most `prefer` tiles further than the nearest food is preferred to eat.
export const COOK = obj({
  job: ref('jobs'),
  meal: ref('items'),
  // Recipes (P5.3, V-132), best first: the cook makes the first whose `main` food (a batch's
  // worth) and `sideCount` of a `side` food can both be had, as its `item`; else plain `meal`.
  recipes: list(
    obj({
      id,
      item: ref('items'),
      main: list(ref('items')),
      side: list(ref('items')),
      sideCount: count,
    }),
  ),
  // A batch's grade: cooking level plus a roll of up to `roll` either way from `stream`, the
  // first grade it reaches (`at`), best first; eating it leaves the grade's `memory`, and a
  // fine batch leaves the cook `fineMemory`.
  grades: list(obj({ id, at: num(), memory: text })),
  roll: count,
  stream: text,
  fineMemory: text,
  fuel: ref('items'),
  from: list(ref('items')),
  gain: num({ min: 1 }),
  batch: num({ min: 1 }),
  minutes: num({ min: 1 }),
  skilled: num({ min: 1 }),
  perPerson: num({ min: 1 }),
  prefer: count,
});
