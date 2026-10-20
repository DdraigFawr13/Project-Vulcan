# Phase 5: Wolves and strangers (5A), then larder, loom and lamp (5B)

Goal: a colony that feeds, clothes and mends itself, and grows by taking in strangers. Entry: Phase 4 done and live (2026-10-20). Plan source: the project file `vulcan/plan/phases/PHASE_5.md`. Design workshop round 1: https://claude.ai/artifact/JaA6PDXSCXvbMXWKErK7wv; taste board: https://claude.ai/artifact/7QMHTRi5A9UFqYcWuk9xuF (decisions V-107 to V-123). Control stays indirect (V-041): colonists choose whom to hunt, where to graze, bury and build, whom to carry and when to flee.

The phase is split in two halves that each go live with a playtest (V-107). This spec covers 5A. 5B (P5.1 farming, P5.2 wells, P5.3 cooking, P5.5 cloth, P5.7 disease, P5.11 mill, P5.12 keeping food, P5.13 light) gets its own question round while 5A builds, and is added here before its first bundle.

## Status

- [x] Spec approved by Morgan, 2026-10-20 (PR #67)
- [ ] Bundle 1, injury and death: P5.6, P5.8
- [x] Bundle 2, the wild valley: P5.4a, tracks (2026-10-20)
- [ ] Bundle 3, flocks: P5.4b, hay
- [ ] Bundle 4, strangers and homes: P5.9, P5.14, the hall
- [ ] Bundle 5, worn paths and roads: P5.10
- [ ] 5A balance and review
- [ ] 5B question round, spec section, bundles, review

Irrigation channels are parked; P5.2 is wells only (V-108).

Taste board picks bind every 5A mock-up (V-123): worn grass, grey stone roads, unmarked predators, fading prints, wattle folds, mounds with wooden markers, a six-part body figure.

## Design questions (VR-62)

- **Priority ladder (V-109).** One ordered list each colonist reads every hour: danger (a predator in sight, a bleeding wound, a hurt person found) beats warmth (V-046, V-080), which beats sleep and hunger, which beat work, where Work sheet priorities apply. Traits move a person's line on a rung (brave stands, timid flees). It owns nothing and gives the chosen rung, cited in the line ("dropped her axe: wolves in sight"). Test: a colonist at work with a wolf in sight leaves the job, and the line names the higher rung.
- **Health (P5.6, V-114, V-115).** A wound is a record on one of six body parts (head, body, arms, legs) with cause, severity, bleeding and care given; a person holds their wounds, a lasting mark is a content entry with a plain effect (a lame leg walks slower, a maimed hand works slower). Whoever finds a hurt person carries them to their own bed (a danger rung); healers on the Heal row bind and redress; a sickroom appears from need once two lie hurt or ill at once (V-061 pattern). Fails: no healer means slower healing and more lasting marks; untreated bleeding kills. Test: a sample mining injury's ledger walks from the fall to the bed to the dressing.
- **Death and graves (P5.8, V-116).** A death records every cause. At the first death colonists site a burial ground outside the town ring; the dead are carried and buried; the grave's sheet names who lies there and why. Everyone who knew them gains a mourning memory, stronger for the close; an unburied body unsettles passers-by. Test: a death's line links its causes, and the grave's sheet repeats them.
- **Wild valley (P5.4a, V-110, V-111, V-112, V-122).** Game herds and one named pack live on the map (V-110); the pack owns its den and its hunger, which rises as game falls. Hunt and Fish rows are pulled by the Food plate; hunters take the largest nearest herd, spare a herd's last few, and want any predator that has attacked; fishing stops where water freezes; hides, bone and fat are leftovers (V-072). On sight each colonist flees to the nearest building or, brave, armed and not alone, stands; a fight is a few blows by skill and weapon, its wounds go to health, witnesses remember it. Animals leave tracks on snow and mud that fade over a day; a hunter crossing fresh tracks follows them. Fails: overhunting drives the pack to town. Test: every attack's line links through the pack's hunger to the scarce game behind it.
- **Flocks (P5.4b, V-113).** A Pasture row on the Build sheet: colonists site a fenced pasture with a fold and a hay meadow; herders tame wild sheep, goats or fowl to fill it; the flock breeds up to what the pasture feeds. Grass feeds it until the first snow, hay after; hay is mown in summer; in autumn herders cull what the hay cannot carry, meat to the store. Fails: a short hay year means a bigger cull; wolves take sheep left out. Test: a flock grows over a year with a herder assigned.
- **Strangers (P5.9, V-117, V-118).** Each newcomer comes from a neighbouring site with a reason from its record (V-028), drawn by spare food, beds and the colony's name (V-118). The Strangers law (Open door, Those in need, Closed) sits on the Laws page; colonists weigh each stranger by culture and memory, and when the band is split the law decides, with a line naming who spoke for and against. Fails: a turned-away stranger leaves with a line. Test: every arrival line links to the event that sent them.
- **Homes (P5.14, V-119, V-121).** Every adult or couple wants a home of their own; the want adds a house plan citing whose want it meets, and the House row sets the effort. Newcomers sleep in the first cottage until their house is up; when the band has all moved out, the first cottage becomes the hall (newcomers' first beds, feast-day meals, mourning). Test: a year with newcomers ends with each household in its own home.
- **Paths and roads (P5.10, V-054, V-120).** Each ground tile counts footfall that decays slowly; wear shows past content thresholds. A Roads row on the Build sheet lays stone on the most worn stretch first, as stone allows, each stretch with a line naming the route and its walks; walking a road is faster. Test: after a year the busiest routes show as tracks, and a road walk is faster, in a table.

Lever list (V-041): normal levers add the Strangers law; the Build sheet gains Pasture and Roads; the Work sheet gains Hunt, Fish, Herd and Heal rows under trade headings (V-071). Nothing targets an animal, a tile or a person.

## Milestones

Order: bundles 1 to 5, then the 5A balance and review. Bundles grep `docs/DECISIONS.md` for the rows they cite. A bundle estimated over 1,200 lines splits into an engine PR and a screen PR (VR-58).

### Bundle 1: P5.6 Health and P5.8 Deaths and graves

Six body parts, wounds, bleeding and healing; the priority ladder with its danger rung; carrying to bed; Heal row; sickroom from need; mining and tool accidents as the first causes; the health sheet; death causes, burial ground, graves, mourning. Mock-up: UI. Done when: a mining injury is carried to bed and treated, and a death is logged with its causes and buried.

- Reading list: `docs/UI_STYLE.md`; `src/engine/needs/MODULE.md`; `src/engine/people/MODULE.md`; `src/engine/build/MODULE.md`; `src/engine/log/MODULE.md`; `src/ui/MODULE.md`

### Bundle 2: P5.4a The wild valley, with tracks

Herds and one named pack from content; Hunt and Fish rows; fight or flee; tracks on snow and mud; hides, bone and fat to the store, the rest to a midden. Mock-up: UI. Done when: a hard winter brings the pack to town with a line that names the scarce game.

- Reading list: `docs/ART.md`; `src/engine/map/MODULE.md`; `src/engine/paths/MODULE.md`; `src/engine/goods/MODULE.md`; `src/engine/region/MODULE.md`; `src/render/MODULE.md`

### Bundle 3: P5.4b Flocks, with hay

Pasture row, fold and meadow; taming, breeding, herding, hay, the autumn cull and butchery. Mock-up: UI. Done when: a flock grows over a year with a herder assigned.

- Reading list: `src/engine/build/MODULE.md`; `src/engine/goods/MODULE.md`; `src/engine/calendar/MODULE.md`; `src/ui/MODULE.md`

### Bundle 4: P5.9 Newcomers, P5.14 Homes of their own, the hall

Arrivals from neighbouring sites with reasons; the Strangers law and its answers; a home for every adult or couple; the first cottage as the hall. Mock-up: UI. Done when: every newcomer's arrival line links to the event that sent them, and a year with newcomers ends with each household in its own home.

- Reading list: `src/engine/region/MODULE.md`; `src/engine/law/MODULE.md`; `src/engine/people/MODULE.md`; `src/engine/build/MODULE.md`; `src/ui/MODULE.md`

### Bundle 5: P5.10 Worn paths and roads

Footfall wear, the Roads row, faster walking on roads. Mock-up: Engine. Done when: after a year the busiest routes (green, fields, forge) show as tracks, and walking a road is faster, in a table.

- Reading list: `src/engine/paths/MODULE.md`; `src/engine/map/MODULE.md`; `src/render/MODULE.md`

### 5A balance and review

The `balance-check` skill over the seed list for two years, then the `phase-review` skill. Done when: a numbers table shows most seeds keep their people through two winters with the pack about.

## Phase done (playtest)

5A: two years with a flock, a hunter and a healer; wolves come in the hard winter and someone stands; a mining injury is carried to bed, treated, and the ledger shows every step; newcomers arrive with reasons and each household ends in its own home. 5B's section adds its own.
