// Roofs and the building trades (6B Bundle 3, P6.11, amends V-056): what a roof is laid of, who
// lays it, how it wears and what a room without one loses (build/roofs.ts, crafts/thatch.ts).

/** Roofs (`buildings.roofs`). The thatcher (`job`, a Priorities row) lays a built house's roof:
 * `thatch.per` floor tiles take one bundle, cut `thatch.cut` minutes each from a `reed` tile
 * kind within `thatch.reach` of the green, or straw a field of `straw.crops` left at its reaping
 * (`straw.per` of its tiles a bundle), and laid `thatch.lay` minutes each at building skill
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
  straw: { per: number; crops: readonly string[] };
  open: number;
}

/** The mason and the lime burner, and the stages a house grows by (`buildings.masonry`, 6B
 * Bundle 3 part 2, P6.9, V-052). The mason (`mason.job`) dresses `dress.stone` stone into one
 * dressed stone, splits a boulder within `split.near` of `split.rock` into slate and stone, lays
 * one slate per `slate.per` floor tiles and sets a wall in `wall.minutes`. The lime burner breaks a
 * boulder by `lime.rock` and burns `burn.limestone` with `burn.fuel` firewood at the kiln into
 * `burn.lime` lime. Both work within `reach` of the green. Stages start from need, never a timer:
 * `stone` when a house's hearths burned `burned` firewood in one winter through `from` walls
 * (rebuilt as `lime` walls where lime can be had, else `clay`); `slate` when its thatch is worn
 * and slate can be had; `wash` when lime can be had for its `from` walls (one lime a `per` of
 * them, `minutes` each), which become `to`. */
export interface MasonryDef {
  reach: number;
  mason: {
    job: string;
    skilled: number;
    dress: { stone: number; minutes: number };
    split: { rock: string; near: number; slate: number; stone: number; minutes: number };
    slate: { per: number; lay: number };
    wall: { minutes: number };
  };
  lime: {
    job: string;
    skilled: number;
    /** Why a kiln is planned for lime (keep/kiln.ts). */
    kiln: string;
    rock: string;
    near: number;
    break: { limestone: number; stone: number; minutes: number };
    burn: { limestone: number; fuel: number; lime: number; minutes: number };
  };
  stages: {
    stone: { name: string; burned: number; from: readonly string[]; lime: string; clay: string };
    slate: { name: string };
    wash: { name: string; from: string; to: string; per: number; minutes: number };
  };
}
