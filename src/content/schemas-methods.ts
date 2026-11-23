// Shape of Vulcan's methods file (src/content/data/methods.json, 6C Slice 5, V-142, V-218): the
// new ways of working colonists can find, the hints that lead to each and the words for them.
import { bool, list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { count, text } from './schema-fields';

const days = num({ min: 1 });
const words = obj({ how: text, short: text });

export const METHODS_SCHEMAS = {
  methods: obj({
    // Each way: its trade (a jobs.json id), the skill and level it needs (none: any), the hints
    // it takes, where the work is done (for the lines) and the lines that count as a failure in it.
    methods: list(
      obj({
        ...{ id: str(), name: text, job: ref('jobs'), skill: opt(str()), from: count },
        ...{ hints: num({ min: 1 }), where: text, failures: list(str()) },
        // What a mishap spoils (the first in store), and whether its work is at a fire.
        ...{ ruins: list(ref('items')), hot: opt(bool()) },
        // What it does for a knower's own work, in per cent (the hook is named for the way); `on` the
        // materials it covers, where it covers some.
        effect: obj({ by: num({ min: 1 }), on: opt(list(str())) }),
      }),
    ),
    // A puzzle starts after `hours` at a trade in the last `days`.
    start: obj({ hours: num({ min: 1 }), days }),
    // Hours at the trade for each work hint (the New Ways law can shorten it).
    work: num({ min: 1 }),
    // Short jobs counted from their lines: each such line is `hours` at `job` for its first actor.
    credit: list(obj({ event: str(), job: ref('jobs'), hours: num({ min: 1 }) })),
    // At most one failure hint a person in `days`; a book hint (an `event` line) in `days`.
    failure: obj({ days }),
    book: obj({ days, event: str() }),
    // A puzzle is put aside at midnight with under `hours` at its trade in the last `days`.
    drop: obj({ days, hours: count }),
    // A stranger's coming: a seen hint at 1 in `odds` for each puzzler, at most `most` a way.
    seen: obj({ odds: num({ min: 1 }), most: num({ min: 1 }), event: str() }),
    // Hearing the tale (tales.json `id`) of a find in the same trade: a hint at 1 in `odds`.
    tale: obj({ odds: num({ min: 1 }), id: str() }),
    // Luck: 1 in `days` working days (`hours` or more at the trade), 1 in `lucky` for a byname
    // in `bynames`.
    luck: obj({ days, lucky: days, bynames: list(str()), hours: num({ min: 1 }) }),
    // A hint of one of `kinds` also goes to everyone puzzling over the same way who worked its
    // trade that day (6C Slice 5, Morgan's card 2026-11-23); `words` name them in the line.
    share: obj({ kinds: list(str()), words: text }),
    // A dream gives the last hint: 1 in `nights` once `days` have passed since the one before.
    dream: obj({ nights: days, days }),
    memories: obj({ found: ref('memories'), learned: ref('memories'), mishap: ref('memories') }),
    // A mishap at a work hint (the New Ways law's 1 in `mishap`): at a `hot` trade, a burned hand
    // (`burn`, a wound) at `hand` per cent, a small fire at `fire` per cent, else spoiled
    // materials; `nothing` when there are none to spoil; `words` for the line.
    mishap: obj({
      ...{ hand: count, fire: count, nothing: text },
      burn: obj({ parts: list(str()), severity: str(), what: text, at: str() }),
      words: obj({ ruined: text, hand: text, fire: text }),
    }),
    // Learning a way from a knower: `apprentice` hours at its trade as their apprentice in its
    // skill, or `beside` hours at it on days a knower worked it too; a book by a knower teaches it.
    spread: obj({
      ...{ apprentice: num({ min: 1 }), beside: num({ min: 1 }) },
      words: obj({ apprentice: text, book: text, beside: text }),
    }),
    // The words for each kind of hint: in its own line (`how`) and in the find's list (`short`).
    kinds: obj({
      ...{ work: words, failure: words, seen: words, book: words },
      ...{ tale: words, luck: words, dream: words },
    }),
    // A failure line's words, by event, filled from its data, and whose failure it is: `actor`,
    // a puzzler named in the line; `trade`, a puzzler who worked the trade that day.
    failed: map(obj({ words: text, by: oneOf('actor', 'trade') })),
    // The screen's words (6C Slice 6, V-221): each way's effect on a knower's work, by way id; a
    // puzzle, its hints and the hints `left`; a known way and `how` it was come by; the colony's
    // list (`found`, `learnt`, `only` one knower) and what is being puzzled over.
    screen: obj({
      effects: map(text),
      ...{ puzzle: text, hint: text, left: text, knows: text, known: text },
      how: obj({ found: text, apprentice: text, book: text, beside: text }),
      ...{ found: text, learnt: text, only: text, kept: text, puzzled: text, puzzler: text },
      ...{ puzzlerWho: text, nobody: text, none: text },
    }),
  }),
};
