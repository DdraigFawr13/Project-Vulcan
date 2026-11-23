// The lord file's shape as the engine reads it (content lord.json, 6C Slice 1, V-216).

export interface LordTitle {
  title: string;
  /** The title for a woman, where it differs. */
  f?: string;
}

export interface LordDef {
  /** By the word a realm's name gives its kind. */
  titles: readonly (LordTitle & { kind: string })[];
  /** For a kind not listed. */
  title: LordTitle;
  reeve: {
    sex: string;
    /** Walker's minutes he covers each minute: he rides. */
    pace: number;
    arrive: number;
    speakBy: number;
    leave: number;
    reach: number;
    look: number;
  };
  /** What each temper adds to the news's memory weight. */
  tempers: Readonly<Record<string, number>>;
  memories: { named: string; bitter: string };
  /** The tithe (6C Slice 2, V-222). */
  tithe: TitheDef;
  /** Favour, its causes and ladder (V-222). */
  favour: FavourDef;
  /** The lord's forest: the find of kind `place` farthest from the green, `reach` tiles round. */
  forest: { place: string; reach: number };
}

export interface FavourStep {
  id: string;
  /** Taken when favour falls to `below`, or rises to `above`. */
  below?: number;
  above?: number;
  text: string;
  /** What it adds to the share, in 100. */
  by: number;
}

export interface FavourDef {
  start: number;
  /** How long each cause counts. */
  days: number;
  /** Each cause's worth and words. */
  causes: Readonly<Record<string, { by: number; text: string }>>;
  ladder: readonly FavourStep[];
  /** The lord's men's blows (V-211). */
  men: { kinds: readonly string[]; parts: readonly string[]; severity: string; what: string };
}

export interface TitheDef {
  /** The Lord law's id (laws.json). */
  law: string;
  /** The share in 100 of what is brought in, and the tempers that take more. */
  rate: number;
  tempers: Readonly<Record<string, number>>;
  /** The item kinds tithed. */
  kinds: readonly string[];
  /** The Build sheet's Tithe barn row and the house size it is sited at. */
  barn: { name: string; start: number; size: string };
  /** A lean year: the tempers that take half, the memory each grown-up keeps, the standing cause. */
  lean: {
    /** Under this many days' eating in store at the visit, the year is lean. */
    days: number;
    half: readonly string[];
    memory: string;
    standing: { by: number; days: number; text: string };
  };
  /** One visit in `search`, the reeve searches the houses. */
  search: number;
}

export interface LordDefs {
  lord: LordDef;
}
