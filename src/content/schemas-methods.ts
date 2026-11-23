// Shape of Vulcan's methods file (src/content/data/methods.json, 6C Slice 5, V-142, V-218): the
// new ways of working colonists can find, the hints that lead to each and the words for them.
import { list, map, num, obj, opt, ref, str } from './schema';
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
      }),
    ),
    // A puzzle starts after `hours` at a trade in the last `days`.
    start: obj({ hours: num({ min: 1 }), days }),
    // Hours at the trade for each work hint (the New Ways law can shorten it).
    work: num({ min: 1 }),
    // Short jobs counted from their lines: each such line is `hours` at `job` for its first actor.
    credit: list(obj({ event: str(), job: ref('jobs'), hours: num({ min: 1 }) })),
    // At most one failure hint a person in `days`; a book hint in `days`.
    failure: obj({ days }),
    book: obj({ days }),
    // A stranger's coming: a seen hint at 1 in `odds` for each puzzler, at most `most` a way.
    seen: obj({ odds: num({ min: 1 }), most: num({ min: 1 }) }),
    // Hearing the tale (tales.json `id`) of a find in the same trade: a hint at 1 in `odds`.
    tale: obj({ odds: num({ min: 1 }), id: str() }),
    // Luck: 1 in `days` working days (`hours` or more at the trade), 1 in `lucky` for a byname
    // in `bynames`.
    luck: obj({ days, lucky: days, bynames: list(str()), hours: num({ min: 1 }) }),
    // A dream gives the last hint: 1 in `nights` once `days` have passed since the one before.
    dream: obj({ nights: days, days }),
    memories: obj({ found: ref('memories') }),
    // The words for each kind of hint: in its own line (`how`) and in the find's list (`short`).
    kinds: obj({
      ...{ work: words, failure: words, seen: words, book: words },
      ...{ tale: words, luck: words, dream: words },
    }),
    // A failure line's words, by event, filled from its data.
    failed: map(text),
  }),
};
