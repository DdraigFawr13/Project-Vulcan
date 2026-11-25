// Shape of Vulcan's asks file (src/content/data/asks.json, 6C Slice 3, V-225): what the colony is
// asked for, by whom and by when.
import { list, num, obj, oneOf, opt, str } from './schema';
import { text } from './schema-fields';

export const ASKS_SCHEMAS = {
  asks: obj({
    // The lord asks from his `from`th visit (the first tithe year's is his second).
    from: num({ min: 1 }),
    // Midwinter, for an ask due by then: the 0-based month and its day.
    midwinter: obj({ month: num({ min: 0, max: 11 }), day: num({ min: 1, max: 28 }) }),
    // Minutes in 100 a grumbler at the Lord law takes over the lord's ask.
    grumble: num({ min: 100 }),
    lord: obj({
      // Tempers whose lord doubles what a passed or late ask costs.
      double: list(str()),
      // The lord's ask by his temper: its words, either a tool kind the smith makes (`count` of
      // at least `quality`) or goods of an item kind or good (`count`, or `share` in 100 of the
      // store), due by his next visit or by midwinter.
      asks: list(
        obj({
          ...{ temper: str(), what: text, tool: opt(str()), good: opt(str()) },
          ...{ count: opt(num({ min: 1 })), share: opt(num({ min: 1, max: 100 })) },
          ...{ quality: opt(str()), due: oneOf('visit', 'midwinter') },
        }),
      ),
    }),
  }),
} as const;
