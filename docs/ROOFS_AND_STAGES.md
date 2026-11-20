# Roofs, the building trades and growth stages

6B Bundle 3 (P6.11, P6.9; V-041, V-052, V-056 amended, V-096, V-097). Content `buildings.roofs`; type `core/masonry.ts`. Nobody is ordered: the levers are the Priorities rows (Thatching under the Wood heading) and the Build sheet.

## Roofs (build/roofs.ts)

Roofs are no longer free (amends V-056). Each built house row (a house, or a room added to one) keeps `roof` ('' none, `thatch`), `roofed` (tick), `roofLine` and `noThatch`. A room in a house with no roof leaks `roofs.open` per mille an hour more air heat (fire `leakOf` adds `roofLeak`); thatch older than `roofs.thatch.wears` years leaks `roofs.thatch.worn` more, and the thatcher lays it again. A room placed in test mode belongs to no house row and keeps the old free roof. API: `roofLeak`, `roofsWanted`, `wornThatch`, `roofAge`, `bundlesFor` (w × h ÷ `thatch.per`), `roofName`, `thatchSpots`, `strawLeft`, `takeStraw`.

Thatch is reed cut on a `roofs.reed` tile kind (marsh), unlimited, or straw from the stubble of a reaped field (`fallow` with a harvest laid): `roofs.straw.per` of its tiles give a bundle, once a harvest (field columns `straw` taken, `strawAt` the `sown` tick it belongs to). Both within `thatch.reach` of the green.

## The thatcher (crafts/thatch.ts)

The Thatching row (`thatch`, the building skill). While a house row wants a roof and reed can be cut, or the stubble in reach holds its whole roof beyond what other thatchers still need, a free able person takes up the nearest such house nobody else is on (`work.tookUpThatching`, citing the house built or its last roof, and the priority line). They cut one bundle at a time at the nearest reed or stubble (`thatch.cut` minutes), then lay them all from beside the door (`thatch.lay` minutes a bundle), shorter with skill at `roofs.skilled`: `build.roofed` names reed or straw. With none to be had, `build.noThatch` once for that house until it is roofed. Person field `bundles`. The house's tile page shows the roof: none yet, thatch and its age, or worn.

## Seeds

Measured with `node tmp` probes on 2026-11-20, within 40 tiles of the start: anvil and smoke have marsh, tallow much marsh, ledger-1 none, so ledger-1 stands roofless until its first harvest's straw.
