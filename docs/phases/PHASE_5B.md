# Phase 5B: Larder, loom and lamp

Goal: a colony that feeds, clothes, lights and mends itself through the winters. Entry: 5A done and live (2026-10-25, `PHASE_5.md`). Plan source: the project file `vulcan/plan/phases/PHASE_5.md`. Workshop: https://claude.ai/artifact/Nd7XxGcKqCBT47eStZJc4k; taste board: https://claude.ai/artifact/7uVoR2f6Sp6mbRdGAvaB9c (decisions V-128 to V-138). Control stays indirect (V-041): colonists choose crops, stores, recipes and when to light a candle; the player sets rows, plates and laws.

## Status

- [x] Spec approved by Morgan, 2026-10-25 (PR #83)
- [x] Bundle 1, stores by kind (V-129), 2026-10-25
- [x] Bundle 2, the larder: P5.1, P5.2 (V-130, V-131, V-149), 2026-10-26
- [x] Bundle 3, kitchen and keeping: P5.3, P5.12, 2026-10-26
  - [x] Part 1: recipes and graded meals, cooks light the hearth, spoiling by place and warmth with weekly store lines, 2026-10-26
  - [x] Part 2: curer and smokehouse, salt seam, cooper and barrels, cellar, potter, kiln, pots and bricks; feeders of the hurt bring a full meal, 2026-10-26
- [x] Bundle 4, mill and bakery: P5.11, harvest home (V-150), 2026-10-26 (engine #88, screens #90)
- [ ] Bundle 5, the loom: P5.5
- [ ] Bundle 6, the lamp: P5.13, soap, lit rooms
- [ ] Bundle 7, sickness: P5.7
- [ ] 5B balance and review

## Design (VR-62)

Every store is a clock: each food runs down at its item's rate, changed by where it lies, how warm it is and how it was kept. Most 5B trades slow a clock (cooking, smoking, barrels, pots, a cellar) or wind one back (harvest, mill, shearing).

- **Stores by kind (V-129).** Store kinds are content, each listing its goods: granary, larder with flour (the cellar later), wood yard, stone and ore yard, later a wool and hide store; the home store keeps the rest. Colonists site one from need when a kind's goods walk far to the home store or fill it, at the spot that shortens the walk from where the good is gathered to where it is used; a far new source gets a second. Haulers carry to the nearest store taking the kind, workers fetch from the nearest. The store's line names the walks it saves. Stack sizes double. Test: a year on, logs sit between the felling and the hearths, and the hauling walk falls, in a table.
- **Fields (P5.1, V-130).** Each field tile keeps fertility: grain draws it, beans put some back, fallow or muck from the fold and midden restore it. Colonists rotate from content (grain, pulses or roots, fallow) and pick crops by season; new crops oats, beans, cabbages, flax. Blight strikes after wet weeks, more where the crop grew last year, spreads tile to tile; reapers cut a patch early. Test: a field sown in spring feeds five through winter on most seeds; every blight line names its wet weeks.
- **Water (P5.2, V-131).** Drinking becomes an errand to the river, a pond or a well. A well plan appears from need (the river freezes or the walk is long), sited on the green (V-050). In a dry spell farmers carry well water to the nearest fields. Test: a watered field outgrows a dry one, in a table.
- **Kitchen and keeping (P5.3, P5.12, V-132).** Recipes are content (pottage, stew, bread, honey cakes); the cook makes the best the store allows, plain, good or fine by skill, and a good meal leaves a small memory. Spoilage reads place (open, store, cellar one level down), warmth and keeping (cooked, smoked, salted, barrelled, potted); a store's loss is one line a week. Larder heading: curer (smokehouse from need; salt only from a salt seam or trade), cooper (barrels), potter (clay, wheel, kiln at the edge; pots and bricks, V-096). Test: a winter with cured food and barrels loses less, in a table; a cook's skill shows in the meal line.
- **Mill (P5.11, V-133).** Anyone grinds on a hand quern at home; when grinding passes a few hours a day, a mill plan appears from need on the river nearest the granary, with a waterwheel that only grinds; it idles while the river is frozen and the quern returns. An oven appears beside it when flour is spare; miller and baker rows. Harvest home grows V-093: when the last field is in, the colony eats the cook's best meal in the hall (V-121). Test: flour falls while the river is frozen, in a three-seed table.
- **Loom (P5.5, V-134).** Two worn things a person: everyday clothes (linen or wool) and an outer layer (wool cloak, leather or hide coat), each with warmth, wear and worth by the maker's skill. Herder shears; weaver spins and weaves wool and flax; tanner (edge) makes leather; tailor makes clothes. A Clothes plate keeps spares; people change when worn. Test: clothed colonists keep warmth up outdoors in winter.
- **Lamp (P5.13, V-135).** Day length follows the month; outdoor work stops at dusk. Indoor trades work after dusk only in a lit room, burning candles, up to the work-hours law's hour (V-075, V-091); a hearth lights its room dimly. Chandler makes tallow and wax candles and soap (fat and ash); beekeeper keeps skeps by the fields. Candles plate. A candlelit room glows at night. Test: a lit workshop works after dusk and an unlit one stops, with a line.
- **Sickness (P5.7, V-136).** Illnesses are content with causes, spread and course: bad water (downstream of midden or tannery), spoiled food eaten hungry, chill, a festering wound, a shared room; strangers can bring the world's diseases. Washing with soap cuts catching it. The healer makes salves and draughts from herbs, sets breaks and stitches by skill and tool quality; a herb garden from need. Test: a trained healer with good tools saves more, in a table.

Lever list (V-041): the Work sheet gains Larder (curer, cooper, potter), Mill (miller, baker), Loom (weaver, tanner, tailor) and Lamp (chandler, beekeeper) rows; plates gain Clothes and Candles. Stores, wells, mills, smokehouses and gardens come from need; nothing targets a tile or a person.

## Milestones

Order: bundles 1 to 7, then the balance and review. A bundle over 1,200 lines splits into an engine PR and a screen PR (VR-58).

### Bundle 1: stores by kind (V-129)

Store kinds, siting from need, hauling to the nearest, doubled stacks, store lines. Mock-up: UI. Done when: the test above.

- Reading list: `docs/DECISIONS.md` V-129 V-138; `src/engine/goods/MODULE.md`; `src/engine/build/MODULE.md`; `src/engine/people/MODULE.md`; `src/render/MODULE.md`

### Bundle 2: P5.1 fields, P5.2 the well

Fertility, rotation, muck, new crops, blight; drinking errand, well, watering. Mock-up: UI. Done when: the two tests above.

- Reading list: `docs/DECISIONS.md` V-089 V-101 V-130 V-131; `src/engine/build/MODULE.md`; `src/engine/needs/MODULE.md`; `src/engine/weather/MODULE.md`; `src/render/MODULE.md`

### Bundle 3: P5.3 kitchen, P5.12 keeping food

Recipes and meal worth; spoilage by place, warmth and keeping; cellar; curer, cooper, potter. Mock-up: Engine. Done when: both tests above.

- Reading list: `docs/DECISIONS.md` V-090 V-132; `src/engine/goods/MODULE.md`; `src/engine/fire/MODULE.md`; `src/engine/mine/MODULE.md`; `src/engine/people/MODULE.md`

### Bundle 4: P5.11 mill and bakery, harvest home

Quern, mill and wheel, oven, miller and baker; the feast in the hall. Mock-up: UI. Done when: the frozen-river table.

- Reading list: `docs/DECISIONS.md` V-085 V-133 V-150; `docs/MILL_AND_FEAST.md`; `src/engine/build/MODULE.md`; `src/engine/people/MODULE.md`; `src/ui/MODULE.md`

### Bundle 5: P5.5 the loom

Clothes and coats, shearing to tailoring, the Clothes plate. Mock-up: UI. Done when: the winter warmth test.

- Reading list: `docs/DECISIONS.md` V-092 V-134; `src/engine/needs/MODULE.md`; `src/engine/flock/MODULE.md`; `src/engine/goods/MODULE.md`; `src/ui/MODULE.md`

### Bundle 6: P5.13 the lamp, soap, lit rooms

Day length, dusk, candles, chandler, beekeeper, soap, the Candles plate, candlelight on the map. Mock-up: UI. Done when: the lit-workshop test.

- Reading list: `docs/DECISIONS.md` V-075 V-135; `src/engine/calendar/MODULE.md`; `src/engine/law/MODULE.md`; `src/render/MODULE.md`; `src/ui/MODULE.md`

### Bundle 7: P5.7 sickness

Illnesses from conditions, contagion, medicines, surgery, herb garden. Mock-up: Engine. Done when: the healer table.

- Reading list: `docs/DECISIONS.md` V-114 V-136; `src/engine/health/MODULE.md`; `src/engine/needs/MODULE.md`; `src/engine/region/MODULE.md`

### 5B balance and review

The `balance-check` skill for two years, then the `phase-review` skill. Done when: most seeds keep their people fed, clothed and warm through two winters.

## Phase done (playtest)

Two years with a farm, flock, loom and healer: the stores sit by their work, the mill stops in the frost, the weaver works late by candlelight, and a sickness's line names its cause.
