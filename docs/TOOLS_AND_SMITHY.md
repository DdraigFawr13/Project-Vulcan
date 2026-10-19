# Tools, smithing and the smithy (Bundle 3, slice 2)

Detail kept out of the module contracts, which are on milestone reading lists with a size budget. The contracts link here. Decisions: V-041, V-049, V-088, V-093.

## Content

- `tools.json` (schema `schemas-tools.ts`): `cartMaterial` (the cart's tools' material) and `job` (the smith job; its jobs.json `workplace` is the forge piece and its `skill` the smithing skill), `kinds` (axe: fell and the firewood split; pick: mine and quarry; hoe: farm; hammer: build and carpentry; each with ingots, charcoal and making minutes), `materials` (stone, bronze, iron: `speed` per cent, `life` in work minutes, `ingot`), `quality` (per cent added to speed by a quality word), `none` (75: no tool), `worn` (per cent of life left under which a held tool is worn, P4.9), `step` (10: per cent of life a quality step from plain adds or takes), `cart` (stone tools of each kind that arrive), `week` (days counted for "who does that work most"), `stream` and `roll` (the smith's quality roll), `skilled` (the smithing dial), `charcoal`.
- items.json: `charcoal`, the ingots (`ore` names the ore), twelve tools (`tool: {kind, material}`). abilities.json: `smithing`. jobs.json and work.json: the `smith` row, last on the Work sheet. buildings.json: furniture kinds `forge`, `anvil`, `tub` (builders' `job`, stone or logs) and the `smithy` block (3 deep by 4 along a wall, `near` the water search, floor part, pieces).

## Goods (`src/engine/goods/tools.ts`)

- A tool is an item; it never stacks. Free tools are kept with the handcart (`restOf`), not on store tiles (a store tile holds one stack of one kind, and each tool has its own wear). `HELD` tools lie on no tile: `owner` is the person, `state` `held`, x and y -1. Item fields `wear` (work minutes left), `worked`, `quality` (a furniture quality id), `trail`. Exports (index.ts): `toolOf`, `speedOf`, `lifeFor`, `qualityStep`, `toolItemId`, `freeTools`, `heldBy`, `isHeld`, `layTool`, `restOf`, `HELD`.
- `speedOf` = material speed + quality bonus; `lifeFor` = life changed 10% a quality step from plain; `freeTools` best first, ties by id; `layTool`; `heldBy`.
- The cart's tools are laid after the store is set up, citing `goods.unloaded` (not in `cart.goods`, so that line is unchanged).

## People

- `smithing.ts`: smithing potential and level are drawn after the band from the `smithing` stream by the band's formula, so `drawBand` is untouched.
- `tools.ts`: `toolFactor(world, content, person, job)` (speed ÷ 100; 0.75 with none; for Bundle 2's mining), `scaled` (equip, then divide the work minutes), `worked` (count the minute, wear the tool, break it at 0: `tool.broke`, notable, naming the hours). Work minutes are divided in jobs.ts (fell, quarry), farm.ts, build.ts, carpentry.ts (a builders' piece counts as `build`) and tend.ts (split). Taking up work with no tool of the kind, a person takes the best free one at the cart with no walking (`tool.taken`, citing its making line). A tool that wears under `worn` writes `tool.worn` once (item field `worn`): it asks for one of the next material up (stone for bronze, bronze for iron), and until one lies free its ingots count in goods `ingotWant`, so the smelter is planned, the miners sink shafts (`mine.shaftPlanned` cites the line) and the smithy follows its ingots (V-100). Table `usage` (person, kind, minutes) decays at midnight by (week-1)/week; at dawn (the day's `workFrom`) the person with most minutes of a kind takes a better free tool, theirs going back to the cart.
- `smith.ts`: wants are people with usage of a kind and no tool of it, or a lower material than the best the store's ingots could make (a poor tool of that material is not made again), counting the best free tool of the kind; most minutes first. A free able person (tools.json `job`, strength 8; one at a time) with a built forge (the job's `workplace`) goes to the ingot stack, then beside the forge, works `minutes × 2 × skilled ÷ (skilled + level)`; when it is finished the ingots and charcoal leave the store (short then: no tool) and `smith.made` lays the tool with the cart: quality = smithing level ± `roll` from the `craft` stream, worded by the furniture quality words. The inputs' trails (at most `metal.trail.most` steps) plus a `made` step go on the tool. The person it is for takes it if it is faster. With no ingots to be had, or ingots but no charcoal (the clamp burns it), one `smith.noIngots` alert says what is lacking and the fix, the plates to raise or the clamp (system state `noIngots`, `noCharcoal`; reset when no want is open). A `tool.taken` line also names the tool put back.
- `fine.ts`: the first fine-or-better piece a maker makes, furniture or tool, adds a notable `craft.firstFine` (person field `fine`).

## Metal work (people: `station.ts`, `charcoal.ts`, `smelt.ts`)

- `station.ts` builds the smelter (Building kind); the clamp spot is the free block nearest the smelter within 10 tiles, and a smithy goes on the best smith's house with open ground, else the next smith's, else ground whose trees are marked to fell first (P4.9). `charcoal.ts`, Charcoal row (woodcutting): while charcoal is under `charcoalNeeded` plus `toolCharcoal` (smith.ts: the charcoal of open tool wants that have ingots) a burner stacks `clamp.logs` of `clamp.wood` on the clamp and lights it (`metal.clampLit`); after `burn` minutes anyone opens it (`metal.charcoalMade`, citing the lighting). `smelt.ts`, Smelt row (smithing): an alloy first, else the metal most wanted (`fetch.ts`); `metal.smelted` / `metal.mixed` cite `work.tookUpSmelting`, which cites the Stock plate.
- Each input the colony lacks for a wanted recipe (charcoal, ore; not an ingot another recipe makes) is one `metal.waiting`, kept in the smelter's `waitFor` and cleared when it arrives. A take-up first checks that a side of the site can be reached, so a job that could not start is not taken up again each minute; one that is taken up and stops at once makes the person look again in 30 minutes (jobs.ts).
- Out of working hours a person on station, charcoal, smelt or smith work keeps what they fetched and resumes next morning. What a recipe or clamp makes that finds no free tile within 4 lies on the maker's own tile (`layAll`). Hauling onto a stack merges the trails.

## Smithy (`src/engine/build/smithy.ts`)

- Table `smithy` (x, y, w, h, house, side, state `plan`/`built`/`sent`, line, why, sent, built). Hourly, once an ingot lies in the store, the colony plans a smithy on the house of its best smith (highest smithing, ties by id; the house their bed or laid bedroll is in), on the outer side of that house or its added rooms nearest water (map water within `near`; ties east, west, south, north), on free buildable ground off every house, field, plan and the store, reachable from the green, with no tree. `smithy.sited` gives the reason; no ground gives one `smithy.noGround` (looked at again daily).
- Open-sided: a stone floor under each of the forge, anvil block and tub. Builders make the pieces like hearths (people/hearth.ts; carpentry.ts `setStation`). `smithy.built` when all stand.
- `setBuild {kind: 'smithy'}` is the Build row (start `buildings.smithy.start`). `sendBack {smithy}` once; a replacement cannot be sent back; the old site is never chosen again.

## Tests

`src/engine/people/tools.test.ts`, `src/engine/build/smithy.test.ts`.

## Screens (`src/ui`)

- new levers: the Bronze Stock plate, the Build sheet's Smithy row (shown with the first ingot; `setBuild`, `sendBack {smithy}`, the plan's reason) and the Work rows Charcoal, Smelting and Smithing (shown once their station exists). `worksrows.ts`: tile pages of the smelter, clamp and smithy. `itemsheet.ts` (P4.6): an `item` page for a tool or ingot: made by, held by and why, speed, wear, and Made from, its trail to the ore, whose tile button only centres the map. The Needs tab adds Tools (hours left, a page link each; no lever).
