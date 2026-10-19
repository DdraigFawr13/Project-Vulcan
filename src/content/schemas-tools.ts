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
    // `serves` lists the work (a jobs.json id, or `split`) a kind of tool is used for.
    kinds: list(
      obj({
        id,
        name: text,
        serves: texts,
        ingots: num({ min: 1 }),
        charcoal: count,
        minutes: num({ min: 1 }),
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
