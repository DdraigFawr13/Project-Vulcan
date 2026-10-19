# Tools, smithing and the smithy (Bundle 3, slice 2)

Detail kept out of the module contracts, which are on milestone reading lists with a size budget. The contracts link here. Decisions: V-041, V-049, V-088, V-093.

## Content

- `tools.json` (schema `schemas-tools.ts`): `kinds` (axe: fell and the firewood split; pick: mine and quarry; hoe: farm; hammer: build and carpentry; each with ingots, charcoal and making minutes), `materials` (stone, bronze, iron: `speed` per cent, `life` in work minutes, `ingot`), `quality` (per cent added to speed by a quality word), `none` (75: no tool), `step` (10: per cent of life a quality step from plain adds or takes), `cart` (stone tools of each kind that arrive), `week` (days counted for "who does that work most"), `stream` and `roll` (the smith's quality roll), `skilled` (the smithing dial), `charcoal`.
- items.json: `charcoal`, the ingots (`ore` names the ore), twelve tools (`tool: {kind, material}`). abilities.json: `smithing`. jobs.json and work.json: the `smith` row, last on the Work sheet. buildings.json: furniture kinds `forge`, `anvil`, `tub` (builders' `job`, stone or logs) and the `smithy` block (3 deep by 4 along a wall, `near` the water search, floor part, pieces).

## Goods (`src/engine/goods/tools.ts`)

- A tool is an item; it never stacks. Free tools are kept with the handcart (`restOf`), not on store tiles (a store tile holds one stack of one kind, and each tool has its own wear). `HELD` tools lie on no tile: `owner` is the person, `state` `held`, x and y -1. Item fields `wear` (work minutes left), `worked`, `quality` (a furniture quality id), `trail`.
- `speedOf` = material speed + quality bonus; `lifeFor` = life changed 10% a quality step from plain; `freeTools` best first, ties by id; `layTool`; `heldBy`.
- The cart's tools are laid after the store is set up, citing `goods.unloaded` (not in `cart.goods`, so that line is unchanged).

## People

- `smithing.ts`: smithing potential and level are drawn after the band from the `smithing` stream by the band's formula, so `drawBand` is untouched.
- `tools.ts`: `toolFactor(world, content, person, job)` (speed ÷ 100; 0.75 with none; for Bundle 2's mining), `scaled` (equip, then divide the work minutes), `worked` (count the minute, wear the tool, break it at 0: `tool.broke`, notable, naming the hours). Work minutes are divided in jobs.ts (fell, quarry), farm.ts, build.ts, carpentry.ts (a builders' piece counts as `build`) and tend.ts (split). Taking up work with no tool of the kind, a person takes the best free one at the cart with no walking (`tool.taken`, citing its making line). Table `usage` (person, kind, minutes) decays at midnight by (week-1)/week; at dawn (the day's `workFrom`) the person with most minutes of a kind takes a better free tool, theirs going back to the cart.
- `smith.ts`: wants are people with usage of a kind and no tool of it, or one slower than the best material the store's ingots and charcoal could make, with no better free tool; most minutes first. A free able person (job `smith`, strength 8) with a built forge goes to the ingot stack, then beside the forge, takes the inputs, works `minutes × 2 × skilled ÷ (skilled + level)`, and `smith.made` lays the tool with the cart: quality = smithing level ± `roll` from the `craft` stream, worded by the furniture quality words. The inputs' trails (local `Step` helper; at most 6 steps) plus a `made` step go on the tool. The person it is for takes it if it is faster. With no ingots to be had, one `smith.noIngots` alert names the plates to raise (system state `noIngots`).
- `fine.ts`: the first fine-or-better piece a maker makes, furniture or tool, adds a notable `craft.firstFine` (person field `fine`).

## Smithy (`src/engine/build/smithy.ts`)

- Table `smithy` (x, y, w, h, house, side, state `plan`/`built`/`sent`, line, why, sent, built). Hourly, once an ingot lies in the store, the colony plans a smithy on the house of its best smith (highest smithing, ties by id; the house their bed or laid bedroll is in), on the outer side of that house or its added rooms nearest water (map water within `near`; ties east, west, south, north), on free buildable ground off every house, field, plan and the store, reachable from the green, with no tree. `smithy.sited` gives the reason; no ground gives one `smithy.noGround` (looked at again daily).
- Open-sided: a stone floor under each of the forge, anvil block and tub. Builders make the pieces like hearths (people/hearth.ts; carpentry.ts `setStation`). `smithy.built` when all stand.
- `setBuild {kind: 'smithy'}` is the Build row (start `buildings.smithy.start`). `sendBack {smithy}` once; a replacement cannot be sent back; the old site is never chosen again.

## Tests

`src/engine/people/tools.test.ts`, `src/engine/build/smithy.test.ts`.
