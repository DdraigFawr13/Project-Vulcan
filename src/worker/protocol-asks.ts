// The wire shapes of the Asks sheet (6C Slice 4, V-237): every ask the colony has not settled, in
// words, and the last few settled.
import type { LedgerLine } from './protocol.ts';

/** One ask on the sheet: who asks and why, what and by when, what answering costs or brings, how
 * far the work has come, and who works it. Every word is the worker's. */
export interface AskCardView {
  id: number;
  /** lord, neighbour, faith, guest or dream. */
  source: string;
  /** "Warlord Ogrgul", "Kraghurnar", "the shrine of the Blood Moon". */
  asker: string;
  /** "the valley's lord", "a neighbouring village", "turned away at the gate". */
  about: string;
  /** The ask's own line, for why?. */
  why: number;
  /** "A fine blade for his hall, by his next visit (the morning after harvest home)." */
  says: string;
  /** A guest's deadline to answer: "Answer by 18:00 tomorrow, or they go on their way." */
  answerBy: string;
  /** What it brings or costs, as numbers where there are numbers. */
  costs: string;
  /** How far it has come: made, set apart, tried and fallen short. Empty while open. */
  progress: string;
  /** Who will work it ("Only its faithful will work it."), and under the Lord law who will not. */
  work: string;
  /** open (no answer yet), taken (with its priority) or passed (let pass, till its day). */
  state: 'open' | 'taken' | 'passed';
  /** The priority 1 to 4 while taken, and its word ("second"). */
  level: number;
  levelWord: string;
  /** A guest's ask is yes or no: Take up has no stepper after it. */
  yesNo: boolean;
}

/** The Asks sheet: waiting for an answer, taken up, let pass till their day, and the last three
 * settled lines (the rest are in the Ledger). `waiting` is the red count on Asks and ⋯. */
export interface AsksView {
  waiting: number;
  open: AskCardView[];
  taken: AskCardView[];
  passed: AskCardView[];
  closed: LedgerLine[];
}
