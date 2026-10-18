# Phase 3: Construction and carpentry

Goal: a roof and a room. Entry: Phase 2 done and live (2026-10-18). Plan source: the project file `vulcan/plan/phases/PHASE_3.md`. Control stays indirect (V-041, V-049): the player says what the colony needs; colonists choose the site, the size, who builds and when. Placing a building on a tile, and deconstructing one, are test-mode tools only.

## Status

- [ ] P3.1 and P3.2 Build job and building parts (one bundle, VR-61)
- [ ] P3.7, P3.3 and P3.8 Build sheet, rooms and the first growth stage (one bundle)
- [ ] P3.4 and P3.5 Carpentry, furniture, beauty, privacy and ownership (one bundle)
- [ ] P3.6 Hearth and firewood
- [ ] Phase review

Taste board (VR-56): https://claude.ai/artifact/K4ebFPoLf9a8T8SAppoNyn. Morgan's picks (2026-10-18), binding every Phase 3 mock-up: slim walls, a band about a third of a tile wide through the middle of the wall's own tile, see-through beside it, so the tile shows the room's floor on its inner half and the ground outside on its outer half, for every floor and ground kind (Morgan: "make sure that it works with different floor types"); roofs are never drawn, and a tile's roof shows on its tile sheet; the hearth is an open ring of stones that also serves as an outdoor campfire; warmth shows as firelight at night plus a word and degrees on the room's page.

## Design questions (VR-62)

- **Build job.** Owns plans (kind, size, stage, tiles, materials delivered) and build progress. Reads stock, paths and skills. Gives built tiles to the map and lines for each plan placed, waiting (and why), built or sent back. Reuses the Work sheet: a Build row with 1 to 4 steppers. Fails: no stone or wood leaves the plan waiting with an alert naming the good and nudges its Stock plate; nobody with Build on leaves it unbuilt with an alert. Test: a wall plan with no command to anyone is built from hauled stone.
- **Site picker (P3.7).** Owns the green's tile and each plan's chosen site. Reads land, water, slope and existing buildings; site scores are worked out when asked, ties broken in tile order (V-049). Gives a site and a reason line. Reuses the steppers on a Build sheet (one row per building kind). Fails: no fitting ground gives a smaller size, then a wait with an alert. Test: same seed, same site; every built plan cites a reason line.
- **Rooms (P3.3).** Owns nothing: a room is worked out from walls, doors and floors when asked, like warmth (V-043). Role, size, beauty and impressiveness come from its tiles and furniture by content weights. Test: sample rooms give the expected role and scores.
- **Growth (P3.8).** Owns nothing new: a stage is a content entry turned into a plan by the build job. Reads a house's beds and sleepers. Fails: no materials means no stage, and the plan waits. Test: a house with more sleepers than beds adds a room, citing the cause.
- **Furniture and ownership (P3.4, P3.5).** Furniture is an item with quality from the maker's skill (content curve); a bed's owner lives on the bed. Beauty and privacy are needs fed by the rooms worked out above. Colonists claim beds themselves; there is no assign lever. Test: an owned private room gives better mood than a barracks.
- **Fire (P3.6).** As V-042: owns lit, fuel left, fuel kind. Heat reaches tiles through `tileTemperature`, worked out when asked: a fire in a closed, roofed room shares its heat over the room's tiles, falling with distance; outdoors it warms only its radius. No stored heat field and no warmth lag in Phase 3 (assumption, to check at the playtest). Tending is the Tend row (V-044); firewood its own Stock plate (V-048). Fails: no firewood puts the fire out with a line citing the empty plate; a banked fire burns low until dawn. Test: a heated room in winter keeps warmth above its warning line.

Lever list (V-041), checked by a test from P3.1: normal levers `setStock`, `setPriority`, `setBuild` (a kind's priority) and `sendBack` (a plan, once); test-mode tools `placeBuilding`, `deconstruct` and the existing dig, mark and store tools.

## Milestones

Order: P3.1 and P3.2, then P3.7, P3.3 and P3.8, then P3.4 and P3.5, then P3.6. Each bundle over 1,200 lines (estimate) splits into an engine PR and a screen PR (VR-58).

### P3.1 Blueprints, build job, material delivery, deconstruct

Plans as entities; builders take up a plan by the Build priority, haul its material and build tile by tile; deconstructing returns the material. Until P3.7, plans come only from the test-mode `placeBuilding` tool (V-049). The lever-list test. Mock-up: UI (with P3.2). Done when: a wall plan is built from hauled stone, and deconstructing returns it.

- Reading list: `docs/DECISIONS.md`; `docs/ARCHITECTURE.md#worker-protocol`; `src/engine/goods/MODULE.md`; `src/engine/people/MODULE.md`; `src/engine/map/MODULE.md`; `src/ui/MODULE.md`

### P3.2 Walls, floors, doors, stairs in wood and stone

Content entries for each part and material; walls block paths and doors pass them; the `buildings` sheet (ART.md row P3.2) with slim autotiled walls over any floor or ground; a stair links to the level below. Mock-up: UI (with P3.1). Done when: a stair built on the surface links to level -1.

- Reading list: `docs/ART.md`; `docs/UI_STYLE.md`; `src/engine/map/MODULE.md`; `src/engine/paths/MODULE.md`; `src/render/MODULE.md`

### P3.7 Build sheet and site picker

A Build sheet (under ⋯) with one row per building kind and 1 to 4 steppers; the green where the cart stopped (V-050); colonists site a house on flat dry ground near the green, pick its size from content (V-051) and show a faint plan with a reason; Send back once. Mock-up: UI. Done when: asking for a house, with no tile chosen, gives a sited plan with a reason line on every seed, and the same seed gives the same site.

- Reading list: `docs/DECISIONS.md`; `docs/UI_STYLE.md`; `src/engine/map/MODULE.md`; `src/engine/region/MODULE.md`; `src/ui/MODULE.md`

### P3.3 Room detection

Rooms worked out from tiles with role, size, beauty and impressiveness; a room page on the tile sheet. Mock-up: engine. Done when: sample rooms give the expected role and scores in a table.

- Reading list: `src/engine/map/MODULE.md`; `src/engine/goods/MODULE.md`

### P3.8 First growth stage

A house gains a room when its sleepers outgrow its beds and materials are in stock (V-052). Mock-up: engine. Done when: a house with more sleepers than beds adds a room, with a ledger line naming the cause.

- Reading list: `src/engine/people/MODULE.md`; `src/engine/needs/MODULE.md`; `src/engine/log/MODULE.md`

### P3.4 Carpentry bench and furniture

The bench; bed, table, chair, chest and shelf; quality from the carpenter's skill, shown as a word and the maker's name. Colonists make furniture a room lacks. Mock-up: UI. Done when: furniture quality follows the carpenter's skill.

- Reading list: `docs/ART.md`; `src/engine/goods/MODULE.md`; `src/engine/people/MODULE.md`; `src/ui/MODULE.md`

### P3.5 Beauty, privacy and ownership

Beauty and privacy needs; colonists claim beds and rooms. Mock-up: engine. Done when: a colonist sleeping in an owned private room has better mood than one in a barracks.

- Reading list: `src/engine/needs/MODULE.md`; `src/engine/people/MODULE.md`

### P3.6 Hearth and firewood

The ring hearth (V-042 to V-048): Tend row, Firewood plate, banked fires, idle rooms burn down, fuel as content, firelight at night. Mock-up: engine. Done when: a heated room in winter keeps the warmth need above its warning line, in a three-seed table.

- Reading list: `docs/DECISIONS.md`; `src/engine/weather/MODULE.md`; `src/engine/needs/MODULE.md`; `src/render/MODULE.md`

## Phase done (playtest)

Ask for a house and get a two-room house with beds before the first snow; the warmth need stops dropping indoors.
