// The wire shapes of what the map draws for goods and of the Stock sheet (P2.4 onward), split from protocol.ts.

/** A tile spot, for the map's goods layer. */
export interface Spot3 {
  x: number;
  y: number;
  z: number;
}

/** What the map draws for goods (P2.4): items on the ground by art frame, the store's tiles and
 * test-mode marks. */
export interface GoodsView {
  items: (Spot3 & { frame: string })[];
  store: Spot3[];
  marks: Spot3[];
  /** Parts planned or to come down (P3.1), for the map's faint plan layer; built ones are in
   * the chunks' `built`. */
  plans: (Spot3 & { part: string; state: string; house: number })[];
  /** Furniture (P3.4): the art id and facing (the page picks the frame), planned ones faint. */
  furniture: (Spot3 & { art: string; facing: string; plan: boolean })[];
  /** Lit fires (P3.6) for the night's firelight: the glow's reach in tiles, dimmer when banked. */
  fires: (Spot3 & { radius: number; banked: boolean })[];
  /** Plans, parts and pieces someone is working now (P3.6): minutes done of the total, for the
   * progress bar. Apart from the lists above so the map redraws only when those change. */
  work: (Spot3 & { done: number; total: number })[];
  /** Field tiles (P4.7) grouped by the art frame they show (planned, sown, ripe, fallow), as
   * tile indices (y * width + x); level 0 only. */
  fields: { frame: string; tiles: number[] }[];
}

/** One good's stock lever (P2.4): how much the colony has and wants, and the levels to pick. */
export interface StockView {
  good: string;
  name: string;
  have: number;
  want: number;
  level: string;
  levels: { id: string; word: string; count: number }[];
  /** What the good is for, from content, shown under its plate. */
  note?: string;
}
