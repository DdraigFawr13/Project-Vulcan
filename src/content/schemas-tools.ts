// Shape of Vulcan's tools file (Bundle 3, V-088): what a tool is made of, how fast it works, how
// long it lasts and how it is made. Speeds are per cent (100 is a stone tool; a person with no
// tool works at `none`).
import { list, map, num, obj, opt, ref } from './schema';
import { count, id, text, texts } from './schema-fields';

export const TOOLS_SCHEMAS = {
  tools: obj({
    // Days over which "who does that work most" is counted, and the stone tools of each kind
    // in the cart (of `cartMaterial`); `job` is the Work sheet kind that smiths them.
    week: num({ min: 1 }),
    cart: count,
    cartMaterial: text,
    job: ref('jobs'),
    none: num({ min: 1 }),
    // Per cent of a tool's life one quality step from plain adds or takes away.
    step: count,
    // A tool is made as furniture is: the quality score is the smith's level plus a roll of up to
    // `roll` from `stream`; `skilled` is the smithing dial of the making minutes.
    stream: text,
    roll: count,
    skilled: num({ min: 1 }),
    charcoal: ref('items'),
    // A held tool with under this per cent of its life left is worn: its holder wants one of the
    // next material up, so the smith wants its ingots (Morgan's card, P4.9).
    worn: num({ min: 1, max: 100 }),
    // Knapping (V-195): with no free tool of a needed kind, someone with some skill of the `job`
    // (jobs.json) makes a stone one from `from` (item counts) in `minutes` at a log stack; `rows`
    // names the Work row of a use that is not itself a jobs.json id.
    knap: obj({
      job: ref('jobs'),
      // Its own quality roll, so knapping leaves the smith's and carpenter's draws as they were.
      stream: text,
      minutes: num({ min: 1 }),
      from: map(num({ min: 1 }), 'items'),
      rows: map(ref('jobs')),
      // Inputs picked up loose where they work when none can be fetched (a stone off the ground).
      loose: list(ref('items')),
    }),
    // `serves` lists the work (a jobs.json id, or `split`) a kind of tool is used for.
    kinds: list(
      obj({
        id,
        name: text,
        serves: texts,
        // The uses nobody takes up without a tool of this kind (V-195), and the words for what
        // stops when the valley's last one breaks.
        needed: opt(texts),
        stops: opt(text),
        // What a stone one is knapped from, when not the file's `knap.from`.
        knap: opt(map(num({ min: 1 }), 'items')),
        ingots: num({ min: 1 }),
        charcoal: count,
        minutes: num({ min: 1 }),
        // How many the cart brings, when not the file's `cart` (the healer's kit: none).
        cart: opt(count),
        // At most this many people want one at once, those who do its work most (the healer's kit).
        holders: opt(num({ min: 1 })),
      }),
    ),
    // `speed` per cent, `life` in work minutes; a material with an `ingot` is smithed from it.
    materials: list(
      obj({
        id,
        name: text,
        speed: num({ min: 1 }),
        life: num({ min: 1 }),
        ingot: opt(ref('items')),
      }),
    ),
    // Per cent added to a tool's speed by its quality word (buildings.json furniture quality).
    quality: map(num()),
  }),
};
