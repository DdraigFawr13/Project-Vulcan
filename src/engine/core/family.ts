// What the family system reads from content (family.json, P6.1, V-145, V-161): closeness, courtship
// and weddings.

export interface FamilyDef {
  /** The hour of the day closeness fades and courtships move on. */
  hour: number;
  /** What two people do together (`doing` values) for an hour to grow closer. */
  leisure: readonly string[];
  /** Tiles apart at most for an hour to count. */
  near: number;
  /** An hour together: `base`, + `shared` a shared trait, − `clash` a trait the other's excludes. */
  like: { base: number; shared: number; clash: number };
  /** Closeness for each tale one told the other. */
  told: number;
  /** Closeness lost each day, per cent. */
  fade: number;
  court: { from: number; days: number; part: number };
  /** Whom a person is drawn to, one drawn per person by `weight`; `woman` is her word for it. */
  orientations: readonly {
    id: string;
    name: string;
    woman?: string;
    drawn: 'other' | 'same' | 'both' | 'none';
    weight: number;
    description: string;
  }[];
  /** A wedding feast only while the store holds this many days of food for everyone. */
  feastDays: number;
  /** Words for the courting and wedding lines ({whose}: the kept home's owner). */
  words: { together: string; alike: string; tales: string; want: string; live: string };
  /** Memories: the couple's on the day, and the feast's for all who ate it. */
  memories: { wed: string; feast: string };
}

export interface FamilyDefs {
  family: FamilyDef;
}
