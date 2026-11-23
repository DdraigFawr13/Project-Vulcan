// What the annals system reads from content (annals.json, Phase 6T, V-191).

/** A noun by count, [none, one, ..., many], the last form for every larger count; `{n}` is the
 * count in words. */
export type Nouns = Readonly<Record<string, readonly string[]>>;

export interface AnnalLineDef {
  /** The ledger event type it tells, with `only` data values. */
  event: string;
  only?: Readonly<Record<string, string>>;
  /** Its sentence, from the line's data; the ledger's own words when left out. */
  one?: string;
  /** Two or more lines of it as one sentence: `{count}`, `{Count}`, `{list}` of `item`s. */
  many?: string;
  item?: string;
  /** Ranks it for the title, the section's cut and the year's paragraphs. */
  weight: number;
  title?: string;
  /** The year's number it adds to, by line, actor, or name in the data's `names` list. */
  tally?: 'came' | 'died' | 'born' | 'homes';
  per?: 'line' | 'actors' | 'names';
  /** A small trouble's words when it comes back season after season, folded into one line of
   * the year's recap ("the smith had no metal for a tool"). */
  fold?: string;
  /** The year's recap lists every line of it this year as one sentence, `{list}` of `item`s
   * (6C Slice 6: the year's finds and the ways lost). */
  year?: string;
}

/** A sentence for one, or for two or more said as a list of `item`s. */
export interface AnnalWords {
  one: string;
  many: string;
  item: string;
}

export interface AnnalsDef {
  repeat: string;
  listMax: number;
  more: string;
  times: readonly string[];
  counts: readonly string[];
  skip: readonly string[];
  titles: { season: string; year: string; quiet: string; quietYear: string };
  /** Each section tells at most `max` kinds, its weightiest; `order` `weight` tells them weightiest
   * first (troubles, by danger), else in the order they first happened. */
  sections: readonly {
    id: string;
    max: number;
    order?: 'time' | 'weight';
    lines: readonly AnnalLineDef[];
  }[];
  still: string;
  numbers: { text: string; levels: string; nouns: Nouns };
  /** What people say: `line` for one telling, `both` for two that differ; `self` the words a
   * teller uses of themselves (first person). */
  say: { max: number; line: string; both: string; self: SelfWords };
  /** Looking ahead at a season's end: the store against the harvest, who still lies sick, a hungry
   * pack, a smith with no metal. */
  ahead: {
    /** The harvest month begins at the turn. */
    now: string;
    lasts: string;
    short: string;
    sick: AnnalWords;
    pack: string;
    smith: string;
    days: readonly string[];
  };
  page: { kicker: string; kickerYear: string; heads: Readonly<Record<string, string>> };
  year: {
    season: string;
    perSeason: number;
    numbers: string;
    nouns: Nouns;
    whose: string;
    cite: number;
    /** The year's title: the first of these sections with a titled kind of `titleMin` weight or
     * more gives its weightiest (its biggest loss or turn). */
    titleFrom: readonly string[];
    titleMin: number;
    /** Small troubles that came back in two seasons or more, as one line: `{list}` of `foldItem`. */
    fold: string;
    foldItem: string;
  };
}

/** First person: the teller's name as `I` (subject), `me`, `my`; `verbs` that change after I;
 * `own` the teller's he/she words when they are the subject; `who` for ", who" after me. */
export interface SelfWords {
  I: string;
  me: string;
  my: string;
  verbs: Readonly<Record<string, string>>;
  own: Readonly<Record<string, string>>;
  who: string;
}

export interface AnnalsDefs {
  annals: AnnalsDef;
}
