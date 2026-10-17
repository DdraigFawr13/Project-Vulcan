// Vulcan's own seasons file (src/content/data/seasons.json): how the forked weather kinds play
// out day by day in the valley (src/engine/weather). Temperatures are degrees C.
import { list, num, obj, ref } from './schema';
import { count, share, text } from './schema-fields';

export const CLIMATE_SCHEMAS = {
  seasons: obj({
    // Added to the valley's yearly mean, one per month in calendar order.
    months: list(num()),
    // The chance each day that a spell of weather ends and a new kind is drawn.
    change: share,
    // The day's wobble, whole degrees either way.
    jitter: count,
    // Yearly rainfall (mm) at which wet and dry weather keep their forked season weights.
    rainfall: num({ min: 1 }),
    kinds: list(
      obj({
        weather: ref('weather'),
        shift: num(),
        wet: share,
        // The spell's words by the valley floor's temperature: the first band it is below.
        words: list(obj({ below: num(), words: text })),
      }),
    ),
    // Freezing degree-days a still-water tile needs to freeze, by depth; warm days thaw at
    // `thaw` times; the count stops at `cap`; `over` is the share of lake water that is "frozen over".
    ice: obj({ shallow: count, deep: count, thaw: count, cap: count, over: share }),
  }),
};
