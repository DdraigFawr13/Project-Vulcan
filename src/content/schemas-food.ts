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
  // The weekly losses are kept `history` weeks (the curer's need reads them); a barrel on a
  // store tile cuts the rate of the food there to `times` of it (cooper.ts, spoil.ts), for as
  // much food as `holds` barrels' worth.
  history: count,
  barrel: obj({ times: share, holds: num({ min: 1 }) }),
  // The cellar (5B Bundle 3): when `need` of the `kinds` have spoiled at walled stores over the kept
  // weeks and a larder has no cellar, one is dug under it; `why` is its reason ({count}). It keeps
  // at `below` degrees and its place factor is `place.below`.
  cellar: obj({ kinds: list(ref('items')), need: count, why: text }),
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

// Curing (V-132): when `need.count` fresh meat, game or fish spoiled over the kept weeks and
// there is no smokehouse, the colony plans one (`house`: a `size` square within `near` tiles of the
// larder, of `cost` of `material` in `minutes` by builders at skill `skilled`). A curer then takes a
// `batch` of one of `from` and `fuel` of `fuelItem`, works `minutes` at skill `skilled` and lays
// `batch` of the `smoked` item, or of `salt.makes` when `salt.per` of `salt.item` came too.
export const CURE = obj({
  job: ref('jobs'),
  // The reason the colony gives for planning the smokehouse; {count} is what spoiled.
  why: text,
  need: obj({ count: num({ min: 1 }) }),
  house: obj({
    size: num({ min: 1 }),
    near: count,
    material: ref('items'),
    cost: num({ min: 1 }),
    minutes: num({ min: 1 }),
    skilled: num({ min: 1 }),
  }),
  from: list(ref('items')),
  batch: num({ min: 1 }),
  fuel: num({ min: 1 }),
  fuelItem: ref('items'),
  minutes: num({ min: 1 }),
  skilled: num({ min: 1 }),
  // With a smokehouse, no salt in the stores and `want` fresh meat, game and fish there, the mine
  // plans a shaft by the nearest `item` stain; `why` is its reason ({fresh}, {word}, {far}, {dir}).
  salt: obj({
    item: ref('items'),
    per: num({ min: 1 }),
    makes: ref('items'),
    want: num({ min: 1 }),
    why: text,
  }),
  smoked: ref('items'),
});

// The cooper (V-132): `logs` of wood made into one `item` (a barrel) in `minutes` at the job's
// skill level `skilled`; barrels are put under the food that spoils (keep.barrel).
export const COOPER = obj({
  job: ref('jobs'),
  item: ref('items'),
  logs: num({ min: 1 }),
  minutes: num({ min: 1 }),
  skilled: num({ min: 1 }),
});

// The potter (V-132): `clay` of the `clayItem` thrown into one `pot.item` in `pot.minutes`, or
// into `brick.per` of `brick.item` in `brick.minutes`, with `fuel` of `fuelItem` to fire it, at
// the job's skill level `skilled`. The kiln (`kiln`): sited when `need` of `kinds` have spoiled at
// walled stores over the kept weeks (`why`, {count}) or a house wants a wall material it lacks
// (`whyWalls`), a `size` square on the free ground nearest the green between `near[0]` and
// `near[1]` tiles from it, built by builders (`cost` of `material` in `minutes` at skill
// `skilled`). A pot under a stack of `kinds` cuts the loss of `holds` of it to `times`.
export const POTTER = obj({
  job: ref('jobs'),
  clay: num({ min: 1 }),
  clayItem: ref('items'),
  pot: obj({ item: ref('items'), minutes: num({ min: 1 }) }),
  brick: obj({ item: ref('items'), per: num({ min: 1 }), minutes: num({ min: 1 }) }),
  fuel: num({ min: 1 }),
  fuelItem: ref('items'),
  kiln: obj({
    size: num({ min: 1 }),
    near: list(count),
    material: ref('items'),
    cost: num({ min: 1 }),
    minutes: num({ min: 1 }),
    skilled: num({ min: 1 }),
    need: num({ min: 1 }),
    why: text,
    whyWalls: text,
  }),
  holds: num({ min: 1 }),
  times: share,
  kinds: list(ref('items')),
  skilled: num({ min: 1 }),
});
