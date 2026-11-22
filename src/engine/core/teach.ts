// What the teaching system reads from content (teach.json, 6B Bundle 6, P6.13, V-074, V-141,
// V-189): masters, apprentices, children watching a parent and a master's loss.

export interface TeachDef {
  /** A master's least level, and how many levels ahead of a learner. */
  master: number;
  ahead: number;
  /** Tiles from a master at the same work; from one's own master. */
  reach: number;
  bondReach: number;
  /** Minutes a day an apprentice works beside their master (teach `help.ts`). */
  lesson: number;
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
  words: {
    law: string;
    child: string;
    friend: string;
    talker: string;
    trait: string;
    died: string;
    left: string;
  };
  school: SchoolDef;
}

/** The schoolroom, its teacher, lessons and books (V-189 q7). */
export interface SchoolDef {
  /** The Build sheet's Schoolroom row: its name, start level, house size and wants inside. */
  build: {
    name: string;
    start: number;
    size: string;
    wants: readonly { kind: string; count: number }[];
  };
  /** The Teaching row's job, and the trait ties go to. */
  teacher: { job: string; trait: string };
  /** Children go to lessons from this per cent of their coming of age. */
  from: number;
  /** Lessons fill the first `hours` of the working day and raise a gift up to `upTo`. */
  lesson: { hours: number; upTo: number };
  /** Minutes of sittings a book takes, the master's `doing` that is free time, the shelf kind,
   * tiles from the master a sitting is, minutes between looks for them while walking. */
  book: { minutes: number; free: readonly string[]; shelf: string; near: number; look: number };
  /** Reading: minutes an evening, per cent pace, and levels under the book's it stops at. */
  read: { minutes: number; pace: number; less: number };
  words: { children: string; masters: string; teacher: string; shelf: string; unfinished: string };
}

export interface TeachDefs {
  teach: TeachDef;
}
