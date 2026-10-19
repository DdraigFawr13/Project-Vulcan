// The wire shapes of a person's needs and of where everyone stands (P2.2 onward), split from protocol.ts.
import type { AnswerView } from './protocol-law.ts';

/** One need or the mood as a bar (P2.2): filled to `share` %, the warning line at `line` %. */
export interface NeedView {
  name: string;
  share: number;
  line: number;
  /** The word for it now (Hungry, Fed, Content...); `low` while under its warning line. */
  word: string;
  low: boolean;
  /** The line that explains it, for "why?". */
  why: number;
  /** What feeds it now, in words (P3.5): "plain room", "own bedroom"; beauty and privacy only. */
  feeds?: string;
}

/** Where a person stands this tick (P2.3), sent with every snapshot so the screen can walk them,
 * with their mood, needs and what they are doing (P2.2) for the person panel. */
export interface WalkerView {
  id: number;
  x: number;
  y: number;
  z: number;
  mood: NeedView;
  needs: NeedView[];
  /** "Sleeping", "Eating", "Taking it easy"... */
  doing: string;
  /** The same in words from content (P2.9), with the line where they took the work up, if any. */
  now: { text: string; why?: number };
  /** Every skill with its level, potential and practice towards the next level, as a % (P2.5). */
  skills: { id: string; name: string; level: number; potential: number; practice: number }[];
  /** The Work sheet (P2.5): each kind of work, its level for them (1 first to 4 last) and word,
   * and the line where they declined it since it last changed. */
  work: {
    job: string;
    name: string;
    /** The skill the work uses, if any, for the sheet to show beside it. */
    skill?: string;
    level: number;
    word: string;
    declined?: number;
  }[];
  /** The tools they hold, each with its hours left (V-088); owned like a bed, no lever. */
  tools: { id: number; kind: string; text: string }[];
  /** The cloak they wear and how worn it is, in words (V-092); none without one. */
  wearing?: string;
  /** Their live memories (V-091): the text, its mood in points, the days before it fades, the
   * line that made it (for "why?") and, when it weighs on the law now, which way (P4.8). */
  memories: { text: string; mood: number; days: number; why: number; lean?: string }[];
  /** Their answer to the work-hours law (P4.8); none while the law is Customary. */
  law?: AnswerView;
  /** Their warmth warning line, 0 to 100, and why it is where it is (V-046), in words. */
  warmLine: { line: number; usual: number; text: string };
}
