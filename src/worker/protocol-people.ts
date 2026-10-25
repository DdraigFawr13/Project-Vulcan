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

/** One person's Health tab (P5.6, P5.8), all in words from content `health.words`. A person never hurt
 * has none. */
export interface HealthView {
  /** A red "+" on the strip while hurt; a "†" and a greyed face once dead. */
  badge?: 'hurt' | 'dead';
  /** Buried: they leave the strip. */
  buried?: true;
  text: string;
  /** Blood as a per cent, the warning line (they faint under it) and the word for it. */
  blood: { share: number; line: number; word: string; low: boolean };
  /** The six parts: bleeding, healing, lasting or none. */
  parts: { id: string; name: string; status: string }[];
  /** Open wounds (the dead's closed ones), each with the line it was taken on for "why?". */
  wounds: { title: string; status: string; cause: string; why: number }[];
  marks: { title: string; effect: string; story: string; why: number }[];
  /** What an open deep wound may leave, while there is no mark yet. */
  hint?: string;
  /** The death line, for the dead. */
  death?: number;
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
  /** Lying on the ground (P5.6, P5.8): `down` (hurt), `dead` (unburied) or `buried` (not drawn);
   * `carried` when someone carries them, so they are drawn over the carrier. */
  lying?: 'down' | 'dead' | 'buried';
  carried?: true;
  /** The tools they hold, each with its hours left (V-088); owned like a bed, no lever. */
  tools: { id: number; kind: string; text: string }[];
  /** The cloak they wear and how worn it is, in words (V-092); none without one. */
  wearing?: string;
  /** Their live memories (V-091): the text, its mood in points, the days before it fades, the
   * line that made it (for "why?") and, when it weighs on the law now, which way (P4.8). */
  memories: { text: string; mood: number; days: number; why: number; lean?: string }[];
  /** Their answer to the work-hours law (P4.8); none while the law is Customary. */
  law?: AnswerView;
  /** Hurt, healed or dead (P5.6, P5.8); none for someone never hurt. */
  health?: HealthView;
  /** Their warmth warning line, 0 to 100, and why it is where it is (V-046), in words. */
  warmLine: { line: number; usual: number; text: string };
  /** Where they sleep and whether they want a home of their own (P5.14), in words. */
  home?: { text: string; why?: number };
  /** A stranger's page while the band speaks or they walk away (P5.9); none for the colony. */
  stranger?: StrangerView;
}

/** A stranger's page (P5.9): who and from where, why they came, what they bring, what now. */
export interface StrangerView {
  /** "A stranger at the green · orc of the Ghor, 31" */
  who: string;
  rows: { name: string; text: string; why?: number }[];
  foot: string;
}
