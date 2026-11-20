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
}

export interface AnnalsDef {
  repeat: string;
  listMax: number;
  more: string;
  times: readonly string[];
  counts: readonly string[];
  skip: readonly string[];
  titles: { season: string; year: string; quiet: string; quietYear: string };
  sections: readonly { id: string; max: number; lines: readonly AnnalLineDef[] }[];
  still: string;
  numbers: { text: string; levels: string; nouns: Nouns };
  say: { max: number; line: string };
  year: {
    season: string;
    perSeason: number;
    numbers: string;
    nouns: Nouns;
    whose: string;
    cite: number;
  };
}

export interface AnnalsDefs {
  annals: AnnalsDef;
}
