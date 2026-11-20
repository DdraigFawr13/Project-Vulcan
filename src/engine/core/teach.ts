// What the teaching system reads from content (teach.json, 6B Bundle 6, P6.13, V-074, V-141,
// V-189): masters, apprentices, children watching a parent and a master's loss.

export interface TeachDef {
  /** A master's least level, and how many levels ahead of a learner. */
  master: number;
  ahead: number;
  /** Tiles from a master at the same work; from one's own master. */
  reach: number;
  bondReach: number;
  /** Practice per minute in per cent of practice alone: beside a master, beside one's own. */
  beside: number;
  apprentice: number;
  /** Levels past potential a teacher can take a learner (never above the teacher less 1). */
  past: number;
  /** Alone, levels from `from` take `times` as long. */
  slow: { from: number; times: number };
  /** Per cent more or less practice per minute for each trait; never under `least` per cent. */
  traits: Readonly<Record<string, number>>;
  least: number;
  hour: number;
  friend: number;
  choose: readonly string[];
  end: number;
  child: { rate: number; upTo: number; reach: number };
  near: number;
  memories: { master: string; learner: string };
  /** Words for the lines: why a master took a learner; how a master went. */
  words: { law: string; child: string; friend: string; trait: string; died: string; left: string };
}

export interface TeachDefs {
  teach: TeachDef;
}
