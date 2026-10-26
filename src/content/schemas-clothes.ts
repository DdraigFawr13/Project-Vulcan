// Shape of Vulcan's clothes file (src/content/data/clothes.json, Phase 5B Bundle 5, P5.5, V-134):
// the two things a person wears, how warm each is outdoors and how long it lasts, its worth by the
// maker's skill, and when people change. Wear is in hours.
import { list, num, obj, ref, str } from './schema';
import { count, id, text } from './schema-fields';

const from = list(obj({ kind: ref('items'), count: num({ min: 1 }) }));

export const CLOTHES_SCHEMAS = {
  clothes: obj({
    // The items.json `good` every garment is grouped under: the Clothes plate counts spares of it.
    good: str(),
    // Everyday clothes and the outer layer: one of each is worn.
    slots: list(obj({ id, name: text })),
    // Each garment: its slot, degrees it adds outdoors, hours of wear it starts with (plain), what
    // the tailor makes it from and the minutes it takes at the tailor's skill.
    garments: list(
      obj({
        item: ref('items'),
        slot: str(),
        warmth: count,
        last: num({ min: 1 }),
        from,
        minutes: num({ min: 1 }),
      }),
    ),
    // Everyday clothes wear an hour each waking hour; an outer layer an hour each hour outdoors,
    // `cold` an hour outdoors under the comfort line.
    cold: num({ min: 1 }),
    // Worth by the maker's skill (level plus the roll): the first whose `at` it reaches; `last`
    // is the per cent of the garment's life it starts with.
    worth: list(obj({ id, word: text, at: num(), last: num({ min: 1 }) })),
    // Per cent of life left under which the wearer changes into a spare from a store, and under
    // which the garment counts as ragged.
    change: count,
    ragged: count,
    // The memories a new fine garment and ragged clothes leave (memories.json).
    memories: obj({ fine: ref('memories'), ragged: ref('memories') }),
    // What the band arrives wearing, and what a newcomer does.
    cart: list(ref('items')),
    newcomer: list(ref('items')),
    // The tailor (jobs.json `job`) makes garments by `garments[].from`; minutes at skill `skilled`
    // (longer below, shorter above); worth is their skill plus or less up to `roll` (`craft`).
    tailor: obj({ job: ref('jobs'), skilled: num({ min: 1 }), roll: count }),
    // The weaver spins and weaves at the loom: each recipe makes `out` of `makes` from `from`.
    weave: obj({
      job: ref('jobs'),
      skilled: num({ min: 1 }),
      recipes: list(
        obj({ makes: ref('items'), out: num({ min: 1 }), from, minutes: num({ min: 1 }) }),
      ),
    }),
    // The loom: a furniture piece (buildings.json `furniture.kinds`) a carpenter makes from need.
    loom: obj({ piece: str() }),
    // The tanner: a `hide` lies `days` in the pits with one `bark` (a log) and takes `minutes` to
    // lay in and again to take out as leather; curing one for a hide coat takes `fur.minutes`.
    tan: obj({
      job: ref('jobs'),
      skilled: num({ min: 1 }),
      hide: ref('items'),
      leather: obj({
        makes: ref('items'),
        bark: ref('items'),
        days: num({ min: 1 }),
        minutes: num({ min: 1 }),
      }),
      fur: obj({ makes: ref('items'), minutes: num({ min: 1 }) }),
    }),
    // The tan pits, sited from need at the edge downstream: `w` by `h` tiles holding `pits` pits,
    // built of `cost` `material` in `minutes`, within `water` tiles of water; the Build row's start.
    pits: obj({
      name: text,
      w: num({ min: 1 }),
      h: num({ min: 1 }),
      pits: num({ min: 1 }),
      material: ref('items'),
      cost: count,
      minutes: num({ min: 1 }),
      water: num({ min: 1 }),
      start: count,
    }),
  }),
};
