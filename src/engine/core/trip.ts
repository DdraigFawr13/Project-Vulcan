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
}
