// What the colony system reads from content (colony.json, P6.6, V-158, V-159): standing and its
// causes, the elder, factions and their petitions.

/** A cause of standing: how much it moves it, for how many days, and its words. */
export interface StandingCause {
  by: number;
  days: number;
  text: string;
}

export interface ColonyDef {
  /** The hour of the day the colony is worked out. */
  hour: number;
  standing: {
    start: number;
    /** Each `per` points from the start lean every law answer one point. */
    per: number;
    words: readonly { word: string; at: number }[];
    trusts: string;
    distrusts: string;
    /** A winter with at most `most` hungry days a person. */
    fedWinter: StandingCause & { most: number };
    /** Each `every` days, when `share` per cent of the answers keep the laws. */
    kept: StandingCause & { every: number; share: number };
    /** Each `every` days a harsh setting stands in hard times, its `harsh` (laws.json). */
    harsh: { days: number; every: number; text: string };
    /** Each `every` days (6A review P2), when someone holds the `hungry` memory and the store
     * holds `food` days of food or less, whatever the laws. */
    storeOut: StandingCause & { every: number; food: number; hungry: string };
    answered: StandingCause;
    stood: StandingCause;
    ignored: StandingCause;
    elderDied: StandingCause;
  };
  elder: {
    every: number;
    least: number;
    sway: number;
    friendDays: number;
    founder: number;
    listener: number;
    listeners: number;
    keeps: number;
    traits: Readonly<Record<string, number>>;
    roles: Readonly<Record<string, number>>;
    follows: string;
    sides: string;
    /** Each villager's vote (V-173): `least` votes to be elder; `friend`, `shared` (a trait) and
     * `plight` (a role a plight calls for) through the voter's eyes; the sitting elder's
     * `incumbent` boost, lost once standing has fallen `drop` since they took over. */
    vote: {
      least: number;
      friend: number;
      shared: number;
      plight: number;
      plights: Readonly<Record<string, string>>;
      afraid: readonly string[];
      incumbent: number;
      drop: number;
      looks: string;
      fallen: string;
    };
  };
  faction: {
    least: number;
    share: number;
    strong: number;
    lean: number;
    stands: string;
    /** Days a new faction holds together whatever its members feel (6A review P5). */
    hold: number;
    /** Days after breaking up within which a faction against the same setting keeps its name. */
    keepName: number;
  };
  petition: { days: number };
  mood: { causes: number };
}

export interface ColonyDefs {
  colony: ColonyDef;
}
