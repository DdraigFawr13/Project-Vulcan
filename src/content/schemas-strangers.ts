// Shape of Vulcan's strangers file (src/content/data/strangers.json, Phase 5 Bundle 4, P5.9 and
// P5.14): when people want homes of their own, what draws strangers, why they come and how the
// band weighs them. Rates are percents, days game days, minutes game minutes.
import { bool, list, map, num, obj, ref, str } from './schema';
import { count, id, text, texts } from './schema-fields';

const percent = num({ min: 0, max: 100 });

export const STRANGERS_SCHEMAS = {
  strangers: obj({
    // A founder wants a home `after` days in the colony, a newcomer from the day they stay; a home
    // is sited leaning toward their work: every `toward` tiles nearer it count as one tile nearer
    // the green. `work` names the table whose first row is the work of each trade (skill).
    home: obj({ after: count, toward: num({ min: 1 }), work: map(str(), 'abilities') }),
    // Each month at `hour` on its first day: `base` percent, times the `food` rate of the first
    // step whose `days` the store lasts everyone (at `eat` food a head a day), times `noBed`
    // percent with no free bed, plus `name` percent for each stranger who stayed, times `winter`
    // percent in winter. The first stranger always comes on `first`.
    draw: obj({
      base: percent,
      food: list(obj({ days: count, rate: percent })),
      noBed: percent,
      name: percent,
      winter: percent,
      eat: num({ min: 1 }),
      hour: num({ min: 0, max: 23 }),
      first: obj({ month: text, day: num({ min: 1 }) }),
    }),
    // Percents: a stranger comes as a couple, and brings one of `animals` (flock species).
    couple: percent,
    animal: percent,
    animals: texts,
    // A neighbour's reason is read from its last `years` of the region's record.
    years: num({ min: 1 }),
    // Minutes a stranger waits at the green while the band speaks.
    wait: num({ min: 1 }),
    // Story Generator event type to a reason kind; a place with none sends a `wander`er.
    reasons: map(str()),
    kinds: list(obj({ id, name: text, words: text, need: bool() })),
    // A colonist speaks for a stranger when the sum is more than 0: `start`, `same` people or
    // `other` (and `kinFirst` more from a people whose `kin` value is that or more), `sick` when
    // they flee sickness, `devout` toward one in need, `lasts` when food lasts to the `harvest`
    // month or `short` (and `greedy` more for the greedy) when not, then traits and memories.
    weigh: obj({
      start: num(),
      same: num(),
      other: num(),
      kin: count,
      kinFirst: num(),
      sick: num(),
      devout: num(),
      lasts: num(),
      short: num(),
      greedy: num(),
      harvest: text,
      traits: map(num(), 'traits'),
      memories: map(num(), 'memories'),
    }),
    // A colonist whose word the law overrode answers it with `dissent` less willingness.
    dissent: num(),
    // A refuser who spoke for a stranger turned away gives them `count` food for the road.
    road: obj({ count: num({ min: 1 }) }),
    law: id,
    memories: obj({ turned: ref('memories'), refused: ref('memories'), feast: ref('memories') }),
    // The pages' words (the worker's): a stranger's page, the Laws page and the Build sheet.
    words: map(str()),
  }),
};
