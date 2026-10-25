// The wire shapes of the Laws page and a person's answer (P4.8), split from protocol.ts.

/** Hours of work and bed, in whole hours. */
export interface HoursView {
  workFrom: number;
  workTo: number;
  sleepFrom: number;
}

/** A person's answer to a law (P4.8, V-091): obeys, grumbles or refuses, with the reason. */
export interface AnswerView {
  person: number;
  name: string;
  answer: 'obeys' | 'grumbles' | 'refuses';
  /** "Hrakmar refuses the long days and keeps the customary hours." */
  text: string;
  /** What weighed for and against, in words ("hardy", "in good spirits", "saw Hrakmar refuse"). */
  for: string[];
  against: string[];
  /** The lines behind the memories that weighed, for "why?" beside the reason. */
  links: { text: string; why: number }[];
  /** The line where they last answered. */
  why: number;
  /** "since 19:30, Day 1 of Seedmonth" */
  since: string;
}

/** The Laws page (P4.8): the work-hours law, its setting, this season's hours and the band's
 * answers, refusals first. */
export interface LawView {
  id: string;
  name: string;
  setting: string;
  settings: { id: string; name: string }[];
  /** The law's hours this season, and the customary ones. */
  hours: HoursView;
  customary: HoursView;
  /** Each setting's hours in words for this season and the rest of the year. */
  about: string;
  /** "Set to Long days at 19:30, Day 1 of Seedmonth." or "Customary since the band arrived." */
  since: string;
  why: number;
  answers: AnswerView[];
  /** The Strangers law (P5.9), below the work-hours law. */
  strangers: StrangersLawView;
}

/** The Strangers law (P5.9, V-117): its setting, what each does, the band's last word on a
 * stranger and, when a split went to the law, everyone's answer, grumbles first. */
export interface StrangersLawView {
  id: string;
  name: string;
  setting: string;
  settings: { id: string; name: string }[];
  /** How the band and the law decide, each setting in words. */
  about: string;
  /** "Those in need, the custom since the colony began." or "Set to Closed at …". */
  since: string;
  why: number;
  /** "Durza of Kraghthar, 9 Leaffall: 2 for, 3 against. Split, so the law decided: …" */
  verdict?: { text: string; why: number };
  answers: AnswerView[];
}
