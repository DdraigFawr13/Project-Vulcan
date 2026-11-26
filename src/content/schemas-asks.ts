// Shape of Vulcan's asks file (src/content/data/asks.json, 6C Slice 3, V-225): what the colony is
// asked for, by whom and by when.
import { list, map, num, obj, oneOf, opt, str } from './schema';
import { text } from './schema-fields';

// What an ask wants: a tool kind or goods (item kinds or goods joined by `|`), a count or a share.
const want = {
  ...{ what: text, tool: opt(str()), good: opt(str()) },
  ...{ count: opt(num({ min: 1 })), share: opt(num({ min: 1, max: 100 })), quality: opt(str()) },
};

export const ASKS_SCHEMAS = {
  asks: obj({
    // The lord asks from his `from`th visit (the first tithe year's is his second).
    from: num({ min: 1 }),
    // Midwinter, for an ask due by then: the 0-based month and its day.
    midwinter: obj({ month: num({ min: 0, max: 11 }), day: num({ min: 1, max: 28 }) }),
    // Minutes in 100 a grumbler at the Lord law takes over the lord's ask.
    grumble: num({ min: 100 }),
    // Days between further tries at an ask's tool once `count` + 1 tries fell short (V-238).
    retry: num({ min: 1 }),
    lord: obj({
      // Tempers whose lord doubles what a passed or late ask costs.
      double: list(str()),
      // The lord's ask by his temper: its words, either a tool kind the smith makes (`count` of
      // at least `quality`) or goods of an item kind or good (`count`, or `share` in 100 of the
      // store), due by his next visit or by midwinter.
      asks: list(obj({ temper: str(), ...want, due: oneOf('visit', 'midwinter') })),
    }),
    // A village's regard from `start`, moved by an ask done, passed or late; its asks are due in
    // `days`; `comes` is who comes by the home road for one ({place}).
    regard: obj({
      ...{ start: num({ min: 0, max: 100 }), done: num(), passed: num(), late: num() },
      ...{ days: num({ min: 1 }), comes: text },
      words: obj({ done: text, passed: text, late: text }),
    }),
    // A village's ask by the trouble its stranger carries.
    village: map(obj(want)),
    // The gift sent back for an ask done, by the village's kind (`else` for the rest).
    gifts: map(obj({ kind: str(), count: num({ min: 1 }) })),
    // The shrine's yearly ask by its faith's first sacred tag; the faithful's memories.
    shrine: obj({ done: str(), passed: str(), asks: map(obj(want)) }),
    // A turned-away stranger's ask to stay a season (`feud` for one fleeing a feud), open
    // `answer` days; those who spoke against them gain the `against` memory.
    guests: obj({ what: text, feud: text, answer: num({ min: 1 }), against: str() }),
    // A dream `days` unfulfilled asks to be backed, open `answer` days: goods for a house or by
    // the dream's skill ({name} the dreamer); the dreamer's memories.
    dreams: obj({
      ...{ days: num({ min: 1 }), answer: num({ min: 1 }), backed: str(), unbacked: str() },
      ...{ house: obj(want), skills: map(obj(want)) },
    }),
  }),
} as const;
