# Phase 6C: The lord's valley

A short phase after 6W and before magic (Phase 7): a liege lord who takes a tithe and asks for things, one Asks sheet for everyone who wants something of the colony, and discoveries made by doing. From Morgan's message of 2026-11-20 (quests, a liege lord who asks and taxes, discoveries and breakthroughs). Morgan took every recommendation on the design form https://claude.ai/artifact/GosRLHcT5shEcXuLDKAVjr and added one note on hints: "And some luck as well" (V-210). The spec's own forks are on the spec form https://claude.ai/artifact/DHHjAv5FP94NPXpM3qqzeF (q1 the reeve on the map, q2 the lord's men, q3 who knows a method, q4 the lord's forest; V-211).

## Status

- [x] Design form answered, 2026-11-20 (V-210)
- [x] Spec form answered, 2026-11-23, every recommendation (V-211)
- [x] Slice 1, the lord and the reeve (engine). Mock-up answered 2026-11-23, every recommendation (V-216, https://claude.ai/artifact/REXNtmdRPMMK3vJr8pGBha); built 2026-11-23 (V-217)
- [ ] Slice 2, the tithe, the Lord law and favour (engine). Mock-up sent 2026-11-23, waiting on Morgan (https://claude.ai/artifact/91We7kCTAGYGzkkTaCU8DD)
- [ ] Slice 3, asks (engine)
- [ ] Slice 4, the lord and asks on screen (screens)
- [ ] Slice 5, hints and breakthroughs (engine)
- [ ] Slice 6, discoveries on screen (screens)
- [ ] Slice 7, the lord comes, petitions, wandering masters, contests, the charter (engine and screens)
- [ ] 6C balance and review

## The rule all of this keeps (V-041)

The lord asks the colony, never a person, and the player answers as the colony: a law, a yes or no to an ask, and a priority. Colonists choose who goes, what to make and how hard to try, and each may grumble, drag their feet or refuse, as with every law. Discoveries come only from what colonists do. No lever names a person or a tile.

## Design (VR-62)

Detail, with what each system owns, reads, fails on and tests: `docs/LORD_AND_ASKS.md`.

- **The lord (Slice 1).** The ruler of the nearest realm, with the temper and byname the pinned `story-generator` gives rulers (checked: commit `6430856`), copied into a new `lord` system's state at arrival and fixed until Phase 9. The reeve comes the morning after the first harvest home and every harvest home after.
- **Tithe, Lord law, favour (Slice 2).** A tithe in kind to a tithe barn the colonists site; Loyal / Grudging / Defiant in `laws.json`, weighed like every law, with hiding and paying against the law through defiance (V-174); favour like standing (V-173), its causes listed; charters above, a higher tithe, a fine and the lord's men below (spec form q2, q4).
- **Asks (Slice 3).** `asks.json` entries from the lord, neighbours, wanderers, the faith and ambitions, each citing its source line; take up or let pass, priority 1 to 4; colonists choose who works them; passing costs favour or regard, never a person.
- **On screen (Slice 4).** The Asks sheet, Lord law and favour on the Laws sheet, the tithe row on Stock, the lord on the Region panel, the reeve on the map (spec form q1).
- **Hints and breakthroughs (Slice 5).** `methods.json`, about 12; hints from work, failures, things seen, books, visitors and tales, plus luck and a rare dream; the New Ways law; mishaps. Who knows a method: spec form q3.
- **Discoveries on screen (Slice 6).** "3 of 5 hints" on the person page with why?; breakthroughs in the ledger and recaps.
- **Extras (Slice 7).** The lord visits, petitions, wandering masters, feast contests, the valley's charter. Later: keeping secrets, outlaws, a rival lord.

Levers (V-041): the Lord law and the New Ways law (Laws sheet); take up or let pass and the 1 to 4 priority (Asks sheet); the tithe barn (Build sheet); trade priorities (Priorities sheet); the Feasts law for the lord's visit. Nobody is picked to go, make or petition.

Left out on purpose: random quests from nowhere, a research screen with points, picking who goes on an ask, captives or hostages, omens and blessing buttons (V-148).

## Slices

Each slice gets a mock-up form answered by Morgan, then a fresh build thread (VR-74). Two lanes can run at once: the lord lane (1, 2, 3, 4) and the discovery lane (5, 6); Slice 7 follows 2, 3 and 5. A slice over 1,200 lines splits (VR-58). Multi-seed tables live in mock-up and balance scripts, never tests (check:full is near its 120 s budget).

### Slice 1: the lord and the reeve

Mock-up: Engine (four seeds: lord, realm, temper, byname, the reeve's line). Done when: the lord test above; a save carries the lord; `npm run check` green.

- Reading list: `docs/DECISIONS.md` V-031 V-041 V-210 V-211; `src/engine/region/MODULE.md`; `src/engine/calendar/MODULE.md`; `src/engine/colony/MODULE.md`; `docs/LORD_AND_ASKS.md`

### Slice 2: the tithe, the Lord law and favour

Mock-up: Engine (five years on four seeds: tithe owed and paid, favour and its causes, Lord law answers, hidden grain). Done when: the shortfall test; Lord law answers are law events; a low-favour ladder step writes its line.

- Reading list: `docs/DECISIONS.md` V-041 V-173 V-174 V-188 V-210; `src/engine/law/MODULE.md`; `src/engine/colony/MODULE.md`; `src/engine/defy/MODULE.md`; `docs/LORD_AND_ASKS.md`

### Slice 3: asks

Mock-up: Engine (five years on four seeds: asks by source, taken, done, let pass, who worked them and why). Done when: the fine-blade test; every ask's line cites a source line; letting one pass costs favour or regard with a line.

- Reading list: `docs/DECISIONS.md` V-041 V-146 V-147 V-201 V-210; `src/engine/people/MODULE.md`; `src/engine/crafts/MODULE.md`; `src/engine/region/MODULE.md`; `docs/LORD_AND_ASKS.md`

### Slice 4: the lord and asks on screen

Mock-up: UI at 390 px (Asks sheet, Laws rows, Stock row, Region panel, the reeve). Done when: an ask is taken up and given a priority while paused, and `npm run test:browser` passes with the new checks in their own spec.

- Reading list: `docs/UI_STYLE.md`; `src/ui/MODULE.md`; `src/worker/MODULE.md`; `src/render/MODULE.md`

### Slice 5: hints and breakthroughs

Mock-up: Engine (ten years on four seeds: hints by kind, breakthroughs, who, when, what each cost, mishaps). Done when: the hints test; a lucky hint and a mishap each write their line; New Ways answers are law events.

- Reading list: `docs/DECISIONS.md` V-141 V-142 V-189 V-199 V-210; `src/engine/teach/MODULE.md`; `src/engine/tales/MODULE.md`; `src/engine/crafts/MODULE.md`; `docs/LORD_AND_ASKS.md`

### Slice 6: discoveries on screen

Mock-up: UI at 390 px (inspector hints row, breakthrough lines, New Ways row). Done when: the hints row shows with why? and `npm run test:browser` passes.

- Reading list: `docs/UI_STYLE.md`; `src/ui/MODULE.md`; `src/worker/MODULE.md`

### Slice 7: the lord comes, petitions, wandering masters, contests, the charter

Mock-up: Engine and UI. Done when: a lord's visit with its feast moves favour with a line; a wandering master's stay leaves a hint. Wandering masters wait for the 6B newcomers fix (slice 3 of the 6B review fixes), since test seeds get few strangers.

- Reading list: `docs/DECISIONS.md` V-143 V-187 V-207 V-210; `src/engine/faith/MODULE.md`; `src/engine/band/MODULE.md`; `src/engine/colony/MODULE.md`; `docs/LORD_AND_ASKS.md`

### 6C balance and review

Ten years on anvil, smoke, tallow and ledger-1: favour paths, tithes, asks, breakthroughs. Balance aims for divergent, story-rich runs; a colony crushed by its lord is a story (design north star, 2026-11-20). Then the `phase-review` skill.
