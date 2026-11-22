// Shape of Vulcan's annals file (src/content/data/annals.json, Phase 6T, V-191): the season and
// year recaps' sections, the ledger lines each section tells and the words it tells them in.
import { list, map, num, obj, oneOf, opt, str } from './schema';
import { count, id, text, texts } from './schema-fields';

// A noun by count: [none, one, ..., many], the last form for every larger count, `{n}` the count
// in words ("two houses").
const forms = list(str());
const nouns = map(forms);

export const ANNALS_SCHEMAS = {
  annals: obj({
    // An item said `{times}` in one list ("a lean-to of one room (four times)"); a list says at
    // most `listMax` items, then `more`.
    repeat: text,
    listMax: num({ min: 1 }),
    more: text,
    // How often, by count: `{times}` in a joined sentence ("twice").
    times: forms,
    // Numbers in words from 0; larger counts are written as digits.
    counts: texts,
    // Kept lines (importance 3, or notable) that no section tells: the turn itself and moods.
    skip: texts,
    titles: obj({ season: text, year: text, quiet: text, quietYear: text }),
    // Sections in the recap's order. Each tells at most `max` kinds of line, the weightiest.
    sections: list(
      obj({
        id,
        max: num({ min: 1 }),
        // `weight`: weightiest first (troubles, by danger); else in the order they happened.
        order: opt(oneOf('time', 'weight')),
        // `event` the ledger type, with `only` data values; `one` its sentence (the ledger's own
        // words when left out); `many` for two or more, from `{count}`, `{Count}` and `{list}`
        // (each line's `item`, said as a list); `weight` ranks it for the title and the year;
        // `title` the recap's title when it is the weightiest; `tally` the year's number it adds
        // to, by `per` line, actor or name in the data's `names` list.
        lines: list(
          obj({
            event: str(),
            only: opt(map(str())),
            one: opt(text),
            many: opt(text),
            item: opt(text),
            weight: count,
            title: opt(text),
            tally: opt(oneOf('came', 'died', 'born', 'homes')),
            per: opt(oneOf('line', 'actors', 'names')),
            // A small trouble's words when it comes back season after season (the year folds it).
            fold: opt(text),
          }),
        ),
      }),
    ),
    // Who leads, when no line this season says: the elder.
    still: text,
    numbers: obj({ text, levels: text, nouns }),
    // What people say: up to `max` tales, as one holder tells it now.
    // `both` when two tellings differ; `self` the teller's first-person words.
    say: obj({
      max: count,
      line: text,
      both: text,
      self: obj({ I: text, me: text, my: text, verbs: map(str()), own: map(str()), who: text }),
    }),
    // Looking ahead: the store against the harvest, who lies sick, a hungry pack, no metal.
    ahead: obj({
      now: text,
      lasts: text,
      short: text,
      sick: obj({ one: text, many: text, item: text }),
      pack: text,
      smith: text,
      days: forms,
    }),
    // The recap page's words (slice 3): the line above the title, and each section's heading; a
    // year's season paragraphs open with their season's name and need none.
    page: obj({ kicker: text, kickerYear: text, heads: map(text) }),
    year: obj({
      season: text,
      perSeason: count,
      numbers: text,
      nouns,
      whose: text,
      // At most this many lines cited by one sentence.
      cite: num({ min: 1 }),
      // The year's title: the first section here with a titled kind of `titleMin` or more.
      titleFrom: texts,
      titleMin: count,
      // Small troubles of two seasons or more, as one line.
      fold: text,
      foldItem: text,
    }),
  }),
};
