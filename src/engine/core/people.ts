// What the people system reads from content: the band's dials (band.json) and the forked races,
// cultures, traits and skills a colonist is made from.
import type { ToolsDef } from './life.ts';

/** Vulcan's band file (src/content/data/band.json): how the five who arrive are drawn (P2.1). */
export interface BandDef {
  size: number;
  /** The skills every colonist has a level and a potential in (abilities ids), in display order. */
  skills: readonly string[];
  /** A skill at this level or more counts as able; the band always has someone able in each `must`. */
  able: number;
  must: readonly string[];
  /** Draws of a whole band before the weakest-placed person is trained up to `able` instead. */
  tries: number;
  /** The culture of a band drawn with no region (a plain seed: tests and tools). */
  homeCulture: string;
  /** Ages run from maturity + `minAdult` years to `ageShare` percent of the race's lifespan. */
  minAdult: number;
  ageShare: number;
  /** Attributes: the race's mean plus the sum of `attributeDice` six-sided dice less 3.5 each. */
  attributeDice: number;
  /** Potential: the mean of the skill's two attributes plus `potentialOffset` and two dice less 7. */
  potentialOffset: number;
  potential: readonly number[];
  /** Level, percent of potential: `levelBase` + `levelAdult` * the share of adult life lived, then
   * scaled by a draw from `levelJitter` percent; a trade is at least `tradeBase` + `tradeAdult`. */
  levelBase: number;
  levelAdult: number;
  levelJitter: readonly number[];
  tradeBase: number;
  tradeAdult: number;
  traits: number;
  /** Where the five stand on arrival, as offsets from the start tile, tried in order. */
  spots: readonly (readonly number[])[];
  /** Hair style weights (`bald` draws no hair overlay). */
  hairStyles: Readonly<Record<string, number>>;
  /** Hair colours by race, and clothing colours by culture (`defaultClothes` for the rest), as
   * #rrggbb: a person's look is drawn once, so it is state, not a picture choice. */
  hair: Readonly<Record<string, readonly string[]>>;
  clothes: Readonly<Record<string, readonly string[]>>;
  defaultClothes: readonly string[];
  /** P2.3: an idle person strolls within `radius` tiles of the camp, then stands `rest` minutes. */
  wander: { radius: number; rest: readonly number[] };
}

export interface PeopleDefs {
  band: BandDef;
  races: readonly {
    id: string;
    name: string;
    attributeMeans: Readonly<Record<string, number>>;
    attributeRange: readonly number[];
    lifespanYears: number;
    maturityYears: number;
  }[];
  traits: readonly { id: string; name: string; weight: number; excludes: readonly string[] }[];
  abilities: readonly { id: string; name: string; learnAttributes: readonly string[] }[];
  /** Bundle 3: tools and how they are smithed (tools.json). */
  tools: ToolsDef;
}
