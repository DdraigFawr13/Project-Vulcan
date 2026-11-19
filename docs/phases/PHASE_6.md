# Phase 6A: Word and law

Phase 6 (People) in two halves (V-153): 6A "Word and law" (P6.2 to P6.7) here; 6B "Kin and craft" (P6.1, P6.8 to P6.13) gets `PHASE_6B.md` while 6A builds. Workshop: https://claude.ai/artifact/3Gt3eW7bWeyZnDunEaZVmo (Morgan, 2026-11-18, all recommended).

## Status

- [x] Spec approved by Morgan, 2026-11-18 (workshop answers, V-153 to V-163)
- [x] Bundle 0, leftovers: check:full under 120 s, a hungry winter breaks new ground, newcomers bring goods, the seed corn kept back (V-165), 2026-11-18. Three years on four valley seeds: tallow/1 cold person-hours in year 2 fell 8,785 to 1,511, its year-3 field grew 48 to 122 tiles and its hungry person-days 3,545 to 1,766 (16 people, not 13); anvil/1, smoke/1 and ledger/1 stay fed.
- [x] Bundle 1, memory ledger and thought line: P6.2 (V-167), 2026-11-18. Mock-up https://claude.ai/artifact/85sfNF6JgAnjQCNuR2WLHg, the first through the `ui-mockups` skill. Done-when in `src/worker/memoryview.test.ts`.
- [ ] Bundle 2, tales and beliefs: P6.3, winter evenings by the hearth (V-168). Mock-up https://claude.ai/artifact/Dpeyo3R6Sq5HQ7rNCNSzey. Done-when in `src/engine/tales/tales.test.ts`.
- [ ] Bundle 3, the self and ambitions: P6.4
- [ ] Bundle 4, new laws and the Laws sheet: P6.5
- [ ] Bundle 5, standing, the elder, factions, petitions, the mood word: P6.6
- [ ] Bundle 6, defiance: P6.7
- [ ] 6A balance and review

## Design (VR-62)

One chain, four clocks: an event becomes a memory, a memory a tale, a tale a belief, a belief an answer or an act. Each link is its own step with its own ledger line and its own clock (memories fade, tales bend, beliefs harden or soften, grievances build), so the inspector walks any act back to its event.

- **Memories (P6.2, V-154).** Each memory carries a weight from how much it touched the person (a need badly short, kin or a friend in it, a first time). Light ones fade in days, heavy ones over seasons, the heaviest become lasting. A Memories tab lists them strongest first with why each matters. A thought line from the strongest memory or need, from templates: in the inspector, and above the head only for the selected person and briefly for anyone whose thought just changed. Weeks of the same few foods lower mood a little (V-146). Test: the tab of a colonist after a hungry winter lists the winter first, with its reason.
- **Tales and beliefs (P6.3, V-155, V-140).** A tale is a copy of one ledger event (who, what, how bad) that points back to it. Tales pass at shared meals, side by side at work, and on winter evenings when idle people gather at a lit hearth to spin, mend and tell stories (5B proposal 3, V-162). Each telling can bend one detail, more often from a boastful or bitter teller. A belief is a content template about a person, a law, a place or the colony, with a strength from doubting to certain, formed from the version heard or a thing seen; the ledger shows tale and truth side by side. Test: one rumour traced across three colonists, changing as it goes.
- **The self (P6.4, V-156).** One or two roles in a person's own story (provider, wronged one, outsider, faithful, guard, rebel) from traits and history; a role leans how they weigh laws and can change after a heavy memory, with a line. Some hold a life ambition that guides free time (V-146). Test: two colonists react differently to the same law, each with a reason line naming the role.
- **Laws (P6.5, V-157).** Rations (Full plates / Short rations / Hunger rations), Punishment for theft and brawls (None / Extra work / The stocks / Send away), and Sickness (V-144), as `laws.json` entries weighed like Work hours. A Laws sheet lists every law, its setting and who keeps, grumbles or refuses. Test: passing a law is a command and every answer is an event.
- **Standing, factions, mood (P6.6, V-158, V-159).** Standing is one colony number on the Laws sheet with its causes: fed winters, kept laws and answered grievances raise it; harsh laws in hard times, unfair punishments and ignored grievances lower it; low standing makes every law easier to refuse. The elder (proposal 1): the most trusted colonist sways friends' answers, and their death shakes standing for a season. A faction forms when at least 3 people and a fifth of the colony hold one grievance strongly; it takes a name from content, answers together, and brings a petition to the Laws sheet (proposal 2), answered by changing the law or letting it stand; it breaks up when the grievance fades. The colony's mood as one word and colour under the clock, tap for its three biggest causes (V-146). Test: a faction forms from a shared grievance, in a table.
- **Defiance (P6.7, V-160).** A ladder climbed one step at a time by grievance and traits: grumble, work slowly, refuse, take from the store, brawl, leave the valley (only with a faction or a long misery, taking their own goods and sometimes their household). Test: each act of defiance links to the memory and belief behind it.

Lever list (V-041): the Laws sheet gains Rations, Punishment and Sickness; petitions are answered only through a law's setting. Nothing targets a person or a tile; nobody is ordered.

## Milestones

Order: Bundle 0, then 1 to 6, then balance and review. A bundle over 1,200 lines splits into engine and screen PRs (VR-58). The first screen bundle (Bundle 1) pilots the synced `ui-mockups` skill and removes its exclude (V-163).

### Bundle 0: leftovers (V-162)

check:full back under 120 s (slow colony-run files share one long-run world each, as `mill.test.ts` does); after a winter under the food plate the Fields need grows (5B proposal 1); newcomers bring goods from their home (sheep, wool, seed or tools, from their home's record; 5B proposal 2). Mock-up: Engine. Done when: check:full under 120 s; anvil's hungry person-days in years 2 and 3 fall, in a four-seed table; a newcomer's arrival line names what they brought.

- Reading list: `docs/DECISIONS.md` V-127 V-137 V-149; `src/engine/build/MODULE.md`; `src/engine/people/MODULE.md`; `docs/STRANGERS_AND_HOMES.md`

### Bundle 1: P6.2 memory ledger and thought line

Mock-up: UI. Done when: the Memories tab test above.

- Reading list: `docs/DECISIONS.md` V-091 V-146 V-154; `src/engine/needs/MODULE.md`; `src/engine/law/MODULE.md`; `src/ui/MODULE.md`; `src/render/MODULE.md`

### Bundle 2: P6.3 tales and beliefs, winter evenings

Mock-up: Engine. Done when: the three-colonist rumour trace.

- Reading list: `docs/DECISIONS.md` V-140 V-155; `src/engine/log/MODULE.md`; `src/engine/needs/MODULE.md`; `src/engine/fire/MODULE.md`; `src/engine/people/MODULE.md`

### Bundle 3: P6.4 the self and ambitions

Mock-up: Engine. Done when: two colonists, one law, two reasons.

- Reading list: `docs/DECISIONS.md` V-146 V-156; `src/engine/law/MODULE.md`; `src/engine/needs/MODULE.md`; `src/engine/people/MODULE.md`

### Bundle 4: P6.5 new laws and the Laws sheet

Mock-up: UI. Done when: every answer to a new setting is an event, in a test.

- Reading list: `docs/DECISIONS.md` V-091 V-144 V-157; `src/engine/law/MODULE.md`; `src/engine/health/MODULE.md`; `src/ui/MODULE.md`

### Bundle 5: P6.6 standing, the elder, factions, petitions, the mood word

Mock-up: UI. Done when: the faction table.

- Reading list: `docs/DECISIONS.md` V-146 V-158 V-159; `src/engine/law/MODULE.md`; `src/engine/needs/MODULE.md`; `src/ui/MODULE.md`

### Bundle 6: P6.7 defiance

Mock-up: Engine. Done when: every defiance line cites a memory and a belief, in a test over a hard winter.

- Reading list: `docs/DECISIONS.md` V-160; `src/engine/law/MODULE.md`; `src/engine/goods/MODULE.md`; `src/engine/people/MODULE.md`; `src/engine/health/MODULE.md`

### 6A balance and review

The `balance-check` skill over three winters, then the `phase-review` skill. Done when: most seeds see at least one faction and one act of defiance by year 3, each explained.

## Phase done (playtest)

Pass Hunger rations in a hard winter: a tale that the store is hoarded spreads at the hearth, a faction forms and petitions, one colonist takes from the store, and the inspector walks the act back through belief and tale to the hungry week.

## 6B shape (V-161)

Families from courtship, a marriage feast and a home of their own; children at their race's pace, helping from a quarter of it; no Marriage law. A Hearths law (Frugal / Steady / Roaring) for the heat system (P6.10). Buildings grow from need (cold through timber asks for stone; thatch wears and asks for slate). Faith from home culture, a shrine once two share it, a priest by the faith's own title, sacred and abhorred things leaning law answers. Bynames (proposal 3) held for 6B.
