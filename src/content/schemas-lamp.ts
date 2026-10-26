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
  }),
} as const;
