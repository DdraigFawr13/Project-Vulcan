// Shape of Vulcan's own life and work files (src/content/data/life.json, P2.2): needs, sleep, warmth,
// leisure, what each food gives, mood words, and the cart the band arrives with. Need values run
// from 0 to `scale`; rates are per game hour.
import { list, map, num, obj, ref, str } from './schema';
import { count, id, text } from './schema-fields';

export const LIFE_SCHEMAS = {
  life: obj({
    scale: num({ min: 100 }),
    // A need back this far above its warning line is met again (one line, not one a minute).
    again: count,
    // Each need falls `fall` an hour; under `low` it is a warning (a ledger line); under `seek`
    // the person goes to put it right. Weights make the mood.
    needs: list(
      obj({
        id,
        name: text,
        fall: count,
        low: count,
        seek: count,
        lowWord: text,
        okWord: text,
        weight: num({ min: 1 }),
      }),
    ),
    // Each need's value when the band arrives, in the order of `needs`.
    start: list(count),
    // Rest an hour asleep on a bedroll or the bare ground; bedtime and rising hours; awake when
    // rest reaches `wake`.
    sleep: obj({ bedroll: count, ground: count, from: count, to: count, wake: count }),
    // Comfortable at `comfort` °C or warmer (`bedroll` degrees warmer asleep in one): warmth
    // rises `rise` an hour, else falls `perDegree` for each degree short. Underground is `below`.
    warmth: obj({ comfort: num(), bedroll: count, rise: count, perDegree: count, below: num() }),
    // Leisure from `from` o'clock to bedtime: recreation gains `gain` an hour, `company` more
    // with someone else at leisure within `reach` tiles.
    relax: obj({ from: count, gain: count, company: count, reach: count }),
    // Food each item gives when one is eaten.
    eat: map(count, 'items'),
    // Mood words, highest first: the first whose `at` the mood reaches.
    mood: list(obj({ word: text, at: count })),
    // The band's handcart and what it carries; each person also brings a `bedroll`.
    cart: obj({
      kind: ref('items'),
      goods: list(obj({ kind: ref('items'), count: num({ min: 1 }) })),
      bedroll: ref('items'),
    }),
    // Most of one kind a tile's stack holds (`default` for the rest).
    stacks: map(count),
  }),
  // P2.4: the colony's work (work.json). Stock levels are the player's lever (V-015): how much
  // of a good the colony wants kept; nobody is ever told what to do.
  work: obj({
    stock: list(
      obj({
        good: ref('items'),
        name: text,
        levels: list(obj({ id, word: text, count })),
        start: str(),
      }),
    ),
    // Felling: the jobs.json job (its skill and strength), minutes a tree takes at skill
    // `skilled` (longer below, shorter above), never within `camp` tiles of the start, trees
    // looked for within `reach` tiles of the store.
    fell: obj({ job: ref('jobs'), minutes: count, skilled: count, camp: count, reach: count }),
    // Carrying to the store: most a person carries at once, and which kinds are carried in.
    haul: obj({ load: num({ min: 1 }), kinds: list(ref('items')) }),
    // The store the band sets up by the cart: its first size and the most tiles it grows to.
    store: obj({ width: num({ min: 1 }), height: num({ min: 1 }), most: count }),
    // The colony's day as it starts (P2.5, a lever since): work is taken up from `from` o'clock
    // until `to`; bedtime is `life.sleep.from`, and they are up for work at `from`.
    hours: obj({ from: count, to: count }),
    // Work priorities (P2.5): the kinds of work on the Work sheet, the level everyone starts at
    // (1 first to 4 last) and the word for each level.
    priority: obj({
      jobs: list(ref('jobs')),
      start: num({ min: 1, max: 4 }),
      words: list(text, 4),
    }),
    // Skills by use (P2.5): minutes of practice from one level to the next, `start` plus
    // `perLevel` times the level now.
    learn: obj({ start: num({ min: 1 }), perLevel: count }),
  }),
};
