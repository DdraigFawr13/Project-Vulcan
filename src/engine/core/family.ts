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
  /** `mourn`: days one widowed mourns before courting again (V-214). */
  court: { from: number; days: number; part: number; mourn: number };
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
  words: {
    together: string;
    alike: string;
    tales: string;
    want: string;
    live: string;
    empty: string;
    unplanned: string;
    girl: string;
    boy: string;
    like: string;
    mother: string;
    father: string;
    daughter: string;
    son: string;
    orphan: string;
    leftHere: string;
  };
  /** Births: a wed woman's daily chance per thousand (times her race's fertility) from coming of
   * age to `until` per cent of the lifespan; days carried and between children; none while the
   * store holds under `leanDays` days of food or she holds `hungry`. */
  birth: {
    perMille: number;
    until: number;
    carryDays: number;
    restDays: number;
    leanDays: number;
    hungry: string;
  };
  /** A child helps from `helpFrom` per cent of coming of age, at these Work sheet kinds only. */
  child: { helpFrom: number; jobs: readonly string[] };
  /** Gifts and weaknesses: `by` from the race's mean; odds in per cent; `kin` adds to a weakness. */
  inherit: { by: number; gift: number; weakness: number; kin: number };
  gifts: Readonly<Record<string, string>>;
  weaknesses: Readonly<Record<string, string>>;
  /** Old age from `from` per cent of the lifespan: `per` in 100,000 a day per year past it. */
  /** A stranger who came for one of `kinds` may leave a child aged within `ages`, `percent`%. */
  left: { percent: number; kinds: readonly string[]; ages: readonly number[] };
  old: { from: number; per: number; cause: string };
  /** Memories: the couple's on the day, the feast's, a birth's, coming of age and the kin lost. */
  memories: {
    wed: string;
    feast: string;
    born: string;
    grown: string;
    spouse: string;
    child: string;
    parent: string;
    /** An orphan's, about the one who took them in. */
    taken: string;
  };
}

export interface FamilyDefs {
  family: FamilyDef;
}
