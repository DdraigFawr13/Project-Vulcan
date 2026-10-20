// The wire shapes of the flock and its pasture (Phase 5 Bundle 3), split from protocol.ts: the
// Build sheet's Pasture row and the Stock sheet's flock plate. Words come from the worker
// (GAME-02); nothing here names an animal or a tile as a target (V-041).

/** The Pasture row of the Build sheet: its level, the need, and the plan once the colony has
 * sited one. Present while wild sheep or goats live in the valley or a pasture exists. */
export interface PastureRow {
  want: { level: number; word: string };
  /** "a pasture for 12 head. Wild sheep graze east of the green, and the colony keeps no flock". */
  need: string;
  plan?: {
    id: number;
    /** `plan` or `built`. */
    state: string;
    /** "72 tiles of grass with a fold ... south-east of the green: planned. Hurdles: 6 of 36 up". */
    words: string;
    why: string;
    /** Planned, nothing built, not itself a replacement. */
    back: boolean;
    sent: boolean;
  };
}

/** The Stock sheet's read-only flock plate: head by kind word and the hay in the rick. */
export interface FlockPlate {
  /** "Sheep", "7 kept: 1 ram, 6 ewes". */
  head: [string, string][];
  /** "830 in the rick, enough for 7 for 118 days". */
  hay: string;
}
