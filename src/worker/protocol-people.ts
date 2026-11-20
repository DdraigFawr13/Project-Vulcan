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
  /** The illness showing now (P5.7), and the last one they are over and safe from. */
  illness?: IllnessView;
  pastIll?: string;
  /** The death line, for the dead. */
  death?: number;
}

/** A bout of illness on the Health tab (P5.7): its course, day `day` of about `of` (hatched
 * once grave), with the line it showed under for "why?". */
export interface IllnessView {
  title: string;
  day: number;
  of: number;
  grave: boolean;
  dayWord: string;
  ofWord: string;
  state: string;
  cause: string;
  draught?: string;
  catching?: string;
  why: number;
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
  /** Lying on the ground (P5.6, P5.8): `down` (hurt), `dead` (unburied), `buried` or `away` (out
   * of the valley, P6.5), neither drawn;
   * `carried` when someone carries them, so they are drawn over the carrier. */
  lying?: 'down' | 'dead' | 'buried' | 'away';
  carried?: true;
  /** The tools they hold, each with its hours left (V-088); owned like a bed, no lever. */
  tools: { id: number; kind: string; text: string }[];
  /** What they wear, one row per garment in slot order (V-092, V-134); none when bare. */
  wearing?: WearingRow[];
  /** The outer garment drawn on them (V-190, Seen at Work Part 3): only while they are outdoors
   * below the warmth comfort line; none indoors, when warm or without one. */
  coat?: CoatView;
  /** Every memory they hold, strongest first (V-091, V-154): see MemoryView. */
  memories: MemoryView[];
  /** The tales they hold, newest first, and what they believe, strongest first (P6.3, V-155). */
  tales: TaleView[];
  beliefs: BeliefView[];
  /** Their byname (6B Bundle 5): the word, the tale as told when it stuck, what happened, and
   * the line that named them. */
  byname?: { word: string; text: string; truth: string; why: number };
  /** Who they see themselves as, and what they want of life (P6.4, V-156). */
  self: SelfView;
  /** What is on their mind (V-154), in quotes, and the line it comes from (0 for none). */
  thought: { text: string; why: number };
  /** Their answer to the work-hours law (P4.8); none while the law is Customary. */
  law?: AnswerView;
  /** Hurt, healed or dead (P5.6, P5.8); none for someone never hurt. */
  health?: HealthView;
  /** Their warmth warning line, 0 to 100, and why it is where it is (V-046), in words. */
  warmLine: { line: number; usual: number; text: string };
  /** Where they sleep and whether they want a home of their own (P5.14), in words. */
  home?: { text: string; why?: number };
  /** Family rows (P6.1): Wed, Born, Taken in, Child; each with the line that says why. */
  kin?: { band: string; text: string; why?: number }[];
  /** A stranger's page while the band speaks or they walk away (P5.9); none for the colony. */
  stranger?: StrangerView;
  /** Seen at work (V-194): the motion of the job they stand working (jobs.json `motion`, with
   * its `effect`), none while they walk, rest or carry. */
  act?: ActView;
  /** The item art of the tool that serves the job they work or walk to (`item.iron-axe`). */
  held?: string;
  /** The item art of the load they carry (`item.logs`). */
  load?: string;
}

/** A job's look while it is worked (V-194): the drawn motion and what flies from it. */
export interface ActView {
  motion: 'swing' | 'dig' | 'crouch' | 'stir' | 'bench';
  effect?: { kind: 'specks' | 'puff' | 'drift'; colours: readonly string[]; count: number };
}

/** A worn garment: its slot, name and worth, the second line, and the line that made it. */
export interface WearingRow {
  slot: string;
  text: string;
  detail: string;
  why?: number;
}

/** The coat drawn on a villager (V-190): its drawing (clothes.json `art`), per cent of life left,
 * worth id and the look the engine's numbers give it: `ragged` in its last `clothes.ragged` per
 * cent, `fine` at the finest worth, else `plain`. */
export interface CoatView {
  art: string;
  left: number;
  worth: string;
  look: 'plain' | 'ragged' | 'fine';
}

/** The Stock sheet's Clothes lines: the spares of each slot, and what the colony holds to make
 * more. */
export interface ClothesPlate {
  slots: { name: string; text: string }[];
  making: string;
}

/** A stranger's page (P5.9): who and from where, why they came, what they bring, what now. */
export interface StrangerView {
  /** "A stranger at the green · orc of the Ghor, 31" */
  who: string;
  rows: { name: string; text: string; why?: number }[];
  foot: string;
}

/** A held memory (V-154): its name ("The hungry spring"), band, a line on why it matters and
 * how long it stays ("+8 mood, 2 days left." or "Hungry on 46 days, … stays until 5 Mistmonth."
 * with how it leans on the law while fresh, P4.8), and the line that made it, for "why?". */
export interface MemoryView {
  text: string;
  band: 'Light' | 'Heavy' | 'Lasting';
  note: string;
  why: number;
}

/** A tale held (V-155): how they came by it, their version, what happened when it differs,
 * where they got it ("Saw it", "Brought word of it, 6 Thawmonth" or "Heard from Cai, 6 Thawmonth")
 * and the line they got it from, for "why?". */
export interface TaleView {
  how: 'Saw' | 'Word' | 'Heard';
  text: string;
  truth?: string;
  from: string;
  why: number;
}

/** A belief held (V-155): "Is sure the woods around the valley are dangerous", and the line
 * that last fed it. */
export interface BeliefView {
  text: string;
  why: number;
}

/** Who someone is (V-156): each role in words ("Sees themselves as the provider.") with what most
 * made it and its line, and their ambition, if any, with the line that set it. */
export interface SelfView {
  roles: { text: string; note: string; why: number }[];
  ambition?: { text: string; why: number };
  /** P6.7: how far a grievance has carried them past refusing (an act step), and why. */
  defiance?: { text: string; note: string; why: number };
  /** 6B: their faith, devotion and title ("The Wells · devout · Wellkeeper"), what it holds
   * sacred, and the line that named them priest (0 otherwise). */
  faith?: { text: string; note: string; why: number };
  /** 6B Bundle 6: their master or apprentice now, and who taught them and whom they taught. */
  teaching?: { text: string; why: number }[];
}
