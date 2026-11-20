// Shape of Vulcan's defiance file (src/content/data/defy.json, P6.7, V-160): the ladder a
// grievance climbs (grumble, work slowly, refuse, take from the store, brawl, leave), each act's
// dials, the memories it leaves and what leaving costs the colony's standing.
import { bool, list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { count, id, text } from './schema-fields';

export const DEFY_SCHEMAS = {
  defy: obj({
    // Worked out daily at `hour`. An act needs a belief at `belief` or more; each step is held
    // `hold` days before the next, and `cool` days under its bar steps a person down.
    hour: num({ min: 0, max: 23 }),
    belief: num({ min: 1, max: 4 }),
    hold: num({ min: 1 }),
    cool: num({ min: 1 }),
    // A step is a law answer (`answer`) or an act needing `bar` points short of keeping the law,
    // moved by `traits`.
    steps: list(
      obj({
        id,
        name: text,
        answer: opt(str()),
        bar: opt(count),
        // Days on the step below before this one, in place of `hold`.
        hold: opt(num({ min: 1 })),
        traits: opt(map(num(), 'traits')),
      }),
    ),
    slow: obj({ every: num({ min: 2 }) }),
    take: obj({ count: num({ min: 1 }), every: num({ min: 1 }) }),
    brawl: obj({
      every: num({ min: 1 }),
      reach: count,
      doing: list(str()),
      deep: num({ min: 0, max: 100 }),
      kinds: list(str()),
      parts: list(str()),
      what: text,
    }),
    // Leaving: `misery` days under `mood`, housemates with them, nobody within `every` days of the
    // last to leave.
    leave: obj({ misery: num({ min: 1 }), mood: count, household: bool(), every: num({ min: 1 }) }),
    // Taking with no law behind it: who went hungry (`memory`) and believes `belief`.
    starving: obj({ memory: ref('memories'), belief: str() }),
    memories: map(ref('memories')),
    // The sentences a Punishment setting's `punish` (laws.json) names: its words, and what it does
    // to someone caught: the next `day` worked to bedtime (`work`) or sat on the `green`, a
    // `memory` they keep, or `leave`, sent out of the valley. A new sentence is a new entry.
    punish: map(
      obj({
        text,
        day: opt(oneOf('work', 'green')),
        memory: opt(ref('memories')),
        leave: opt(bool()),
      }),
    ),
    standing: obj({ by: num(), days: num({ min: 1 }), text }),
  }),
};
