# Roofs, the building trades and growth stages

6B Bundle 3 (P6.11, P6.9; V-041, V-052, V-056 amended, V-096, V-097). Content `buildings.roofs` and `buildings.masonry`; type `core/masonry.ts`. Nobody is ordered: the levers are the Priorities rows (Thatching under Wood; Masonry and Lime burning under Stone) and the Build sheet.

## Roofs (build/roofs.ts)

Roofs are no longer free (amends V-056). Each built house row (a house, or a room added to one) keeps `roof` ('' none, `thatch`), `roofed` (tick), `roofLine` and `noThatch`. A room in a house with no roof leaks `roofs.open` per mille an hour more air heat (fire `leakOf` adds `roofLeak`); thatch older than `roofs.thatch.wears` years leaks `roofs.thatch.worn` more, and the thatcher lays it again. A room placed in test mode belongs to no house row and keeps the old free roof. API: `roofLeak`, `roofsWanted`, `wornThatch`, `roofAge`, `bundlesFor` (w × h ÷ `thatch.per`), `roofName`, `thatchSpots`, `strawLeft`, `takeStraw`.

Thatch is reed cut on a `roofs.reed` tile kind (marsh), unlimited, or straw: each reaping of a `roofs.straw.crops` field (barley, oats) leaves a bundle for every `roofs.straw.per` of its tiles, kept on the field (column `straw`, `straw.ts`, added in fieldlife `finishReaping`) until taken. Both within `thatch.reach` of the green.

## The thatcher (crafts/thatch.ts)

The Thatching row (`thatch`, the building skill). While a house row wants a roof and reed can be cut, or the fields in reach hold its whole roof beyond what other thatchers still need, a free able person takes up the nearest such house nobody else is on (`work.tookUpThatching`, citing the house built or its last roof, and the priority line). They cut one bundle at a time at the nearest reed or stubble (`thatch.cut` minutes), then lay them all from beside the door (`thatch.lay` minutes a bundle), shorter with skill at `roofs.skilled`: `build.roofed` names reed or straw. With none to be had, `build.noThatch` once for that house until it is roofed. Person field `bundles`. The house's tile page shows the roof: none yet, thatch and its age, or worn.

## Growth stages (build/stages.ts, V-186)

Each hour a built house row with no `stage` may start one, from need and never a timer, with `build.stageWanted` (why, and what the colony wants), and says once what it waits on (`build.stageWaits`). In order: worn thatch where slate can be had (in the stores, or a boulder within `mason.split.near` of slate rock inside `masonry.reach`) wants a slate roof, and worn thatch with no slate to be had says so once in the colony's life (`build.noSlate`, citing the roof; the tile's roof words add "no slate is within reach", V-206); a main house whose hearths burned `stages.stone.burned` firewood in one winter (`burned`, `burnYear`, counted by `noteBurn` from tending, which keeps the winter's first tending as `burnLine`, the line the want cites) through timber or daub walls wants them in dressed stone, set in lime where lime can be had, else clay (`mortar`), laid dry (`stages.stone.dry`, a `build.laidDry` line) once it has waited `dryAfter` days for clay (V-203); clay daub walls want limewash once lime can be had. API: `slateCanBeHad`, `limeCanBeHad`, `bouldersBy`, `wallsOf`, `limeWanted`, `clayMortarWanted` (the potter and miner dig it).

## The mason (crafts/mason.ts) and lime burner (crafts/lime.ts)

Masonry (`mason`, stoneworking, strength 9): one mason per staged house (`mason`, `masonTook`). Slate: lay it from beside the house if enough is to hand (`slateFor`, w × h ÷ `slate.per`), else split the nearest reachable slate boulder (`mason.split`, 10 slate, 10 stone). Stone: per wall, set it (`mason.walled`, swapped in place, `build.rebuilt` after the last) once 3 ashlar and 1 mortar are to hand, else dress 2 stone into an ashlar (`mason.dressed`). Wash: every daub wall at once (`mason.washed`). Lime burning (`limeburn`, crafting): one burner, only while `limeWanted` is above the lime held; burns 2 limestone with 2 firewood beside the kiln (`lime.burned`, 4 lime, V-203), else breaks a boulder by limestone rock (`lime.broke`, `quarrying.ts`). With no kiln, one is planned for lime. New walls: `wall-ashlar-lime` (25‰), `wall-ashlar-clay` (35‰), `wall-ashlar-dry` (50‰), `wall-daub-washed` (60‰).

## Seeds

Measured with `node tmp` probes on 2026-11-20, within 40 tiles of the start: anvil and smoke have marsh, tallow much marsh, ledger-1 none, so ledger-1 stands roofless until its first harvest's straw.

Ten years, default levers (`npm run stages`, 2026-11-20): stages wanted / walls rebuilt / roofs slated / stages still open.

- anvil: 5 / 3 / 0 / 2 (no slate boulder reachable; stone set in clay, waits on the miner's clay)
- smoke: 8 / 1 / 2 / 5 (lime mortar; 15 lime burnings could not keep up)
- tallow: 4 / 4 / 0 / 0 (lime mortar)
- ledger-1: 8 / 4 / 4 / 0 (clay mortar; slate waited a day for the mason's split)

No seed builds in daub, so limewash is shown only by `crafts/mason.test.ts`.
