// The asks file's shape as the engine reads it (content asks.json, 6C Slice 3, V-225).

/** One lord's ask, by his temper: a tool kind the smith makes (at least `quality`) or goods of an
 * item kind or good; `count` of them, or `share` in 100 of what the store holds. */
export interface LordAskDef {
  temper: string;
  what: string;
  tool?: string;
  good?: string;
  count?: number;
  share?: number;
  quality?: string;
  due: 'visit' | 'midwinter';
}

export interface AsksDef {
  from: number;
  midwinter: { month: number; day: number };
  /** Minutes in 100 a grumbler at the Lord law takes over the lord's ask. */
  grumble: number;
  lord: { double: readonly string[]; asks: readonly LordAskDef[] };
}

export interface AsksDefs {
  asks: AsksDef;
}
