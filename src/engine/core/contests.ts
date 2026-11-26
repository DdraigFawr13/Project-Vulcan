// What the harvest-home contests read from content (contests.json, 6C Slice 7 part 3, V-236,
// V-241).

export interface ContestKindDef {
  id: string;
  /** "the ploughing match". */
  name: string;
  /** What the valley must do for it: `none`, `field` (a field laid out), `brewer` (a cask brewed). */
  needs: string;
  /** The skill it is won by, at least `least` to stand up; none for the trial of strength. */
  skill?: string;
  least?: number;
  attribute: string;
  /** The winner's words: "cut the straightest furrow". */
  won: string;
  /** The byname a winner of `wins` earns, `m` for a man where it differs, then the spares. */
  byname: string;
  m?: string;
  spares: readonly string[];
  /** The tool kind the lord gives as its prize. */
  prize: string;
}

export interface ContestsDef {
  each: number;
  lord: number;
  least: number;
  enter: {
    base: number;
    traits: Readonly<Record<string, number>>;
    rival: number;
    won: number;
  };
  roll: number;
  wins: number;
  beaten: number;
  memories: { won: string; lost: string; rival: string };
  kinds: readonly ContestKindDef[];
}

export interface ContestsDefs {
  contests: ContestsDef;
}
