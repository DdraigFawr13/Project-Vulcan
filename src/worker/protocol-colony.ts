// The wire shapes of the colony's standing, elder, factions and mood (P6.6), split from
// protocol.ts.

/** The Laws sheet's head (P6.6, V-158, V-159): standing and its causes, the elder, petitions. */
export interface ColonyView {
  /** 0 to 100, its word ("Steady"), and what it leans every answer in words, if anything. */
  standing: number;
  word: string;
  lean: string;
  /** The causes still counting, the same words summed, biggest first: "+8", "a fed winter". */
  causes: { by: number; text: string; times: number; why: number }[];
  /** "Eadgyth is the elder: one of the founding band and steady. 4 friends lean their way." */
  elder?: { person: number; text: string; why: number };
  factions: FactionView[];
  /** The colony's mood word under the clock, and its causes. */
  mood: MoodView;
}

/** A faction and its petition. */
export interface FactionView {
  id: number;
  name: string;
  law: string;
  /** "Colm, Eadgyth and Domnall" */
  members: string;
  count: number;
  /** "They ask that the Rations law be Short rations, not Hunger rations." */
  ask: string;
  /** The setting asked for, its name, and the petition's state. */
  asks: string;
  asksName: string;
  state: 'open' | 'stood' | 'ignored';
  /** "Answer within 5 days." or what became of it. */
  note: string;
  why: number;
}

/** The colony's mood under the clock (P6.6, V-146): a word, its place (0 best), the causes. */
export interface MoodView {
  word: string;
  rank: number;
  causes: { name: string; people: number; by: number; why: number }[];
}
