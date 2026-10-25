// Shape of Vulcan's laws file (src/content/data/laws.json, P4.8, V-091): each law's settings and
// what weighs on a person's answer to each. One setting is the custom (no `hours`): the colony's
// own day, short in winter.
import { list, map, num, obj, opt, ref, str } from './schema';
import { count, id, text } from './schema-fields';

const hours = obj({ from: num({ min: 1, max: 23 }), to: num({ min: 2, max: 24 }) });

export const LAWS_SCHEMAS = {
  laws: obj({
    // Willingness starts at `start` less the setting's `ask`, adds (mood − half the scale) ÷
    // `moodPer` and `low` for each of `needs` under its warning line, then the setting's leans;
    // `obey` or more obeys, `grumble` or more grumbles, else refuses. Someone within `sight`
    // tiles on the same level, or in the same house, sees a refuser keep the customary hours.
    answer: obj({
      start: num(),
      obey: num(),
      grumble: num(),
      moodPer: num({ min: 1 }),
      low: num(),
      needs: list(ref('needs')),
      sight: count,
    }),
    // The verb each answer takes in its ledger line ("refuses the long days").
    words: obj({ obeys: text, grumbles: text, refuses: text }),
    laws: list(
      obj({
        id,
        name: text,
        /** The law named in a line: "the work-hours law". */
        law: text,
        start: id,
        settings: list(
          obj({
            id,
            name: text,
            days: text,
            ask: num(),
            hours: opt(hours),
            winter: opt(hours),
            winterLean: opt(num()),
            // The Strangers law (P5.9): the reason kinds (strangers.json) a split band lets in.
            lets: opt(list(str())),
            saw: opt(ref('memories')),
            grumbled: opt(ref('memories')),
            traits: map(num(), 'traits'),
            memories: map(num(), 'memories'),
          }),
        ),
      }),
    ),
  }),
};
