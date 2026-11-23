// Trips, camps and their troubles (6W Slice 5, V-206): work.json `scout`'s dials, read by land
// `camp.ts`, `trouble.ts` and `search.ts`.

export interface TripDials {
  /** A trip the scout expects to take over `over` minutes there and back (or not back by
   * bedtime) packs their bedroll and a day's food for each day it may take plus `spare` days, at
   * most `most`; it is due home after its walk times `due` per cent. */
  pack: { over: number; spare: number; most: number; due: number };
  /** At camp below `fire` °C, with a tree or log within `wood` tiles, they light a fire that
   * warms them `heat` degrees; cold on the way, they sit by one `warm` minutes. A camp within
   * `pack` tiles of the wolves' den draws a hungry pack. */
  camp: { fire: number; heat: number; wood: number; warm: number; pack: number };
  /** A fall: each hour walking on `ground` (or lying snow) far from home, `perHour` in `per`;
   * the wound kind, the parts it may take, and how it happened. */
  fall: {
    ground: readonly string[];
    perHour: number;
    per: number;
    wound: string;
    parts: readonly string[];
    what: string;
  };
  /** Losing the way: each hour on unknown land in `weather` (named by `words`), `perHour` in
   * `per`, once a trip; they wander `days` days within `wander` tiles. */
  lost: {
    weather: readonly string[];
    words: Readonly<Record<string, string>>;
    perHour: number;
    per: number;
    days: number;
    wander: number;
  };
  /** A scout `days` past due is worried for (memory `memory`); next morning the colony wants a
   * searcher, who finds them within `sight` tiles. */
  late: { days: number; memory: string; sight: number };
  /** The finds (6W Slice 5 part 2, V-206): places laid at worldgen at least `from` tiles from the
   * green, found by whoever sees them; one within `magic` tiles of an aura spot is noted
   * (`magicWords`). */
  places: { from: number; magic: number; magicWords: string; kinds: readonly PlaceKind[] };
  /** Curios: each hour on the surface more than `far` tiles from the green, 1 in `per`, at most
   * one a person a season. */
  curio: { far: number; per: number; list: readonly Curio[] };
  /** With no new find for `days` days and nothing short, the colony wants a scout to see what
   * lies beyond, `on` tiles past the known land's edge. */
  beyond: { days: number; on: number };
  /** A newcomer's word of a good on the road in: wrong `wrong` per cent of the time; it pulls
   * the next scout for that good `lean` tiles toward its way. */
  word: { wrong: number; lean: number };
  /** Prospecting (6W Slice 7, V-215): anyone beside a rock face over a seam spots it each hour
   * 1 in `per` plus 1 in `per` a mining level, times `rocks` by the face rock's place in the
   * ore's `vein.rocks` (best, second, any other); a seam is not spotted within `apart` tiles of
   * one of its ore already found. A prospector walks along faces up to `day` minutes, each next
   * face within `along` tiles; a word of ore along the road pulls them `word` tiles that way. A
   * walked face is fresh again a year on, or for a miner `better` levels above its walker (V-226). */
  prospect: {
    per: number;
    rocks: readonly number[];
    apart: number;
    day: number;
    along: number;
    word: number;
    better: number;
  };
}

/** One kind of find: placed by `rule` (`size` is the rule's own measure: trees about a grove,
 * metres of rise for a lookout, of cliff for a cave or den, clay tiles in a bank), `gap` tiles
 * apart, at most `most`; `use` what finding it opens (`work`: fellers work round it, `clay`: its
 * bank is dug, `fish`: anglers fish it, `look`: whoever stands there sees twice as far; `ore`: a seam spotted, mined beside, V-215); `tale`
 * the tale it starts; `then` the words after the line. */
export interface PlaceKind {
  id: string;
  name: string;
  rule: 'spring' | 'grove' | 'bank' | 'pool' | 'lookout' | 'cliff' | 'seam';
  size: number;
  gap: number;
  most: number;
  use?: 'work' | 'clay' | 'fish' | 'look' | 'ore';
  tale: string;
  then: string;
}

/** A small odd thing found far out: its words, and the memory a third of them leave. */
export interface Curio {
  id: string;
  what: string;
  memory?: string;
}
