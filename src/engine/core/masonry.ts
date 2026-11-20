// Roofs and the building trades (6B Bundle 3, P6.11, amends V-056): what a roof is laid of, who
// lays it, how it wears and what a room without one loses (build/roofs.ts, crafts/thatch.ts).

/** Roofs (`buildings.roofs`). The thatcher (`job`, a Priorities row) lays a built house's roof:
 * `thatch.per` floor tiles take one bundle, cut `thatch.cut` minutes each from a `reed` tile
 * kind within `thatch.reach` of the store, or taken as straw from a reaped field (`straw.per`
 * of its tiles a bundle, once a harvest), and laid `thatch.lay` minutes each at building skill
 * `skilled`. Air in a room under no roof leaks `open` per mille more an hour (fire/air.ts);
 * thatch older than `thatch.wears` years leaks `thatch.worn` more. */
export interface RoofsDef {
  job: string;
  skilled: number;
  thatch: {
    name: string;
    per: number;
    cut: number;
    lay: number;
    reach: number;
    wears: number;
    worn: number;
  };
  reed: readonly string[];
  straw: { per: number };
  open: number;
}
