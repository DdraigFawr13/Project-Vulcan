// The asks file's shape as the engine reads it (content asks.json, 6C Slice 3, V-225).

/** What an ask wants: a tool kind the smith makes (at least `quality`) or goods of an item kind
 * or good (several joined by `|`); `count` of them, or `share` in 100 of what the store holds. */
export interface GoodAskDef {
  what: string;
  tool?: string;
  good?: string;
  count?: number;
  share?: number;
  quality?: string;
}

/** One lord's ask, by his temper, due by his next visit or by midwinter. */
export interface LordAskDef extends GoodAskDef {
  temper: string;
  due: 'visit' | 'midwinter';
}

export interface AsksDef {
  from: number;
  midwinter: { month: number; day: number };
  /** Minutes in 100 a grumbler at the Lord law takes over the lord's ask. */
  grumble: number;
  /** Days between further tries at an ask's tool once `count` + 1 fell short. */
  retry: number;
  lord: { double: readonly string[]; asks: readonly LordAskDef[] };
  /** A neighbouring village's regard, from `start`: what done, passed and late asks move it by;
   * a village's ask is due in `days`; `comes` names who comes for it; `words` say why it moved. */
  regard: {
    start: number;
    done: number;
    passed: number;
    late: number;
    days: number;
    comes: string;
    words: { done: string; passed: string; late: string };
  };
  /** A village's ask by the trouble its stranger carries (strangers.json kinds). */
  village: Readonly<Record<string, GoodAskDef>>;
  /** The gift a village sends back for an ask done, by its kind (`else` for any other). */
  gifts: Readonly<Record<string, { kind: string; count: number }>>;
  /** The shrine's yearly ask by its faith's first sacred tag, and the faithful's memories. */
  shrine: { done: string; passed: string; asks: Readonly<Record<string, GoodAskDef>> };
  /** A turned-away stranger's ask to stay a season (`feud` its words for one fleeing a feud), open
   * `answer` days; those who spoke against them gain `against`. */
  guests: { what: string; feud: string; answer: number; against: string };
  /** A dream `days` unfulfilled asks to be backed, open `answer` days; the goods it wants for a
   * house or by its skill (`{name}` the dreamer); the dreamer's memories. */
  dreams: {
    days: number;
    answer: number;
    backed: string;
    unbacked: string;
    house: GoodAskDef;
    skills: Readonly<Record<string, GoodAskDef>>;
  };
}

export interface AsksDefs {
  asks: AsksDef;
}
