// Shape of Vulcan's lamp file (src/content/data/lamp.json, P5.13, V-075, V-135): first light and
// dusk per month, which work goes on after dusk and by what light, and the candles that burn.
import { list, map, num, obj, ref, str } from './schema';

export const LAMP_SCHEMAS = {
  lamp: obj({
    // First light and dusk, in hours of the day, at the middle of each calendar month; the engine
    // blends them day by day.
    daylight: list(list(num({ min: 0, max: 24 }), 2)),
    // Work kinds (work.json `priority.jobs` or a person's `job`) that go on in the dark, that go
    // on by a fire's dim light (or a candle), and that need a candle burning in their room.
    // Work in none of the three is outdoor work, which stops at dusk.
    dark: list(str()),
    dim: list(str()),
    candle: list(str()),
    // The furniture kind each candle trade works at: its room is the one that must be lit.
    at: map(str()),
    // What burns, first to last: a candle lights its room for `minutes` of work.
    candles: list(obj({ item: ref('items'), name: str(), minutes: num({ min: 1 }) })),
    // The candles the band brings, kept with the cart until burned.
    cart: obj({ item: ref('items'), count: num({ min: 0 }) }),
    // The chandler (V-135): works `minutes` (shorter with skill, `skilled`) at a lit hearth on the
    // first recipe the colony wants (soap while the store holds under `soap.keep`, else candles
    // while the Candles plate is short), from what the store holds. A healer washes a wound with
    // soap: one soap does `soap.washes` dressings, and a washed wound festers `soap.fester` per cent
    // as often.
    chandler: obj({
      job: str(),
      minutes: num({ min: 1 }),
      skilled: num({ min: 1 }),
      recipes: list(
        obj({
          id: str(),
          from: map(num({ min: 1 }), 'items'),
          makes: map(num({ min: 1 }), 'items'),
        }),
      ),
      soap: obj({
        item: ref('items'),
        keep: num({ min: 0 }),
        washes: num({ min: 1 }),
        fester: num({ min: 0, max: 100 }),
      }),
    }),
    // A lit fire leaves one `item` of ash beside its hearth for every `every` minutes it burns,
    // while the colony holds fewer than `keep`; past that the ash is raked out and scattered.
    ash: obj({ item: ref('items'), every: num({ min: 1 }), keep: num({ min: 0 }) }),
    // Bees (V-135): once a field stands, a stand of `stand` skeps is wanted at the field's edge
    // nearest woods (trees within `woods` tiles); the beekeeper makes each skep in `skep.minutes`,
    // catches a swarm into an empty one with `swarm.chance` per cent a working day in the
    // `swarm.months`, and in `harvest.month` takes `honey` and `wax` from each skep with bees.
    bees: obj({
      job: str(),
      stand: num({ min: 1 }),
      woods: num({ min: 1 }),
      skep: obj({ minutes: num({ min: 1 }), months: list(str()) }),
      swarm: obj({ months: list(str()), chance: num({ min: 0, max: 100 }) }),
      harvest: obj({
        month: str(),
        honey: num({ min: 0 }),
        wax: num({ min: 0 }),
        minutes: num({ min: 1 }),
      }),
    }),
  }),
} as const;
