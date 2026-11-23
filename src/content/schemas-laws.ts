// Shape of Vulcan's laws file (src/content/data/laws.json, P4.8, V-091): each law's settings and
// what weighs on a person's answer to each. One setting is the custom (no `hours`): the colony's
// own day, short in winter.
import { bool, list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { count, id, text } from './schema-fields';

const hours = obj({ from: num({ min: 1, max: 23 }), to: num({ min: 2, max: 24 }) });

export const LAWS_SCHEMAS = {
  laws: obj({
    // Willingness starts at `start` less the setting's `ask`, adds (mood − half the scale) ÷
    // `moodPer` and `low` for each of `needs` under its warning line, then the setting's leans;
    // `obey` or more obeys, `grumble` or more grumbles, else refuses. Whoever sees it (needs
    // `sees`, life.json `sight`) sees a refuser keep the customary hours.
    answer: obj({
      start: num(),
      obey: num(),
      grumble: num(),
      moodPer: num({ min: 1 }),
      low: num(),
      needs: list(ref('needs')),
      // P6.5: once someone changes their answer, they hold the new one at least `settle` days.
      settle: count,
      // P6.5: a refuser openly flouting Rations is a line at most once in `every` days.
      every: count,
    }),
    // The verb each answer takes in its ledger line ("refuses the long days").
    words: obj({ obeys: text, grumbles: text, refuses: text, store: text }),
    laws: list(
      obj({
        id,
        name: text,
        /** The law named in a line: "the work-hours law". */
        law: text,
        start: id,
        // Answered only when a case splits the band (the Strangers law), not when set.
        split: opt(bool()),
        // P6.5: each answer as the Laws sheet words it ("{name} keeps {days}.").
        say: opt(obj({ obeys: text, grumbles: text, refuses: text })),
        // P6.5: a line the Laws sheet adds after what the setting does.
        note: opt(text),
        settings: list(
          obj({
            id,
            name: text,
            days: text,
            // P6.5: what the setting does, in words for the Laws sheet.
            about: opt(text),
            ask: num(),
            // 6C Lord law (V-222): the per cent of the lord's share carried to the tithe barn, and
            // `unset` for the setting before the lord comes (no lever picks it, no faction asks it).
            tithe: opt(num({ min: 0, max: 100 })),
            unset: opt(bool()),
            hours: opt(hours),
            winter: opt(hours),
            winterLean: opt(num()),
            // P6.5 Rations: a keeper eats at most `share` per cent of a full day's food a day and
            // holds `kept` each day it bites; `store` leans when the store lasts to the harvest
            // or falls short of it.
            share: opt(num({ min: 1, max: 99 })),
            kept: opt(ref('memories')),
            // Needs the setting is known to leave low (hunger under rations): not held against it.
            expects: opt(list(ref('needs'))),
            store: opt(obj({ lasts: num(), short: num() })),
            // P6.5 Sickness: the catching-sick lie in the sick-house, or leave the valley.
            sick: opt(oneOf('house', 'away')),
            // 6B Hearths (P6.10): a tender who keeps it tops a used fire under `topBelow` minutes of
            // fuel up to `top`, lights one only under the hearth line plus `below` degrees, and
            // banks it at night only when `bank`. Steady (no `hearth`) is work.json `fire.tend`.
            hearth: opt(obj({ top: count, topBelow: count, below: num(), bank: bool() })),
            // The Strangers law (P5.9): the reason kinds (strangers.json) a split band lets in.
            lets: opt(list(str())),
            saw: opt(ref('memories')),
            grumbled: opt(ref('memories')),
            traits: map(num(), 'traits'),
            memories: map(num(), 'memories'),
            // P6.4: how each role (self.json) and life ambition leans on it.
            roles: opt(map(num())),
            ambitions: opt(map(num())),
            // P6.6: standing lost each `standing.harsh.every` days it stands in hard times, and
            // the names a faction against it takes (colony.json).
            harsh: opt(num({ min: 1 })),
            faction: opt(list(text)),
            // P6.7: the beliefs that carry a grievance with it into acts (tales.json), and what a
            // Punishment setting does to a thief or brawler caught (defy.json `punish`).
            beliefs: opt(list(str())),
            punish: opt(str()),
            // 6B faith (P6.8): the values (kin, honour, war, freedom, order, wealth, learning) it
            // serves (+1) or harms (−1); a faith's follower leans by what it holds sacred or abhors
            // (worship.json `lean`). Feasts: the feast days a year it keeps beyond the harvest home.
            values: opt(map(num())),
            feasts: opt(count),
            // 6B Apprentices (P6.13): every master takes one, by choice, or none (engine teach).
            apprentices: opt(oneOf('all', 'choice', 'none')),
            // 6C New Ways (V-218): whether a keeper begins puzzles and has luck, hours a work hint,
            // 1 in `mishap` work hints going wrong, and 1 working minute in `trying` spent trying
            // (0 none) while puzzling (engine discover).
            ways: opt(
              obj({
                start: bool(),
                luck: bool(),
                work: num({ min: 1 }),
                mishap: num({ min: 1 }),
                trying: count,
              }),
            ),
          }),
        ),
      }),
    ),
  }),
};
