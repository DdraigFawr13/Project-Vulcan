# Phase 6B: Kin and craft

The second half of Phase 6 (V-153): P6.1 and P6.8 to P6.13, with callings (V-175) and bynames. Shape from the workshop (https://claude.ai/artifact/3Gt3eW7bWeyZnDunEaZVmo, V-161); defaults in V-182 (Morgan, 2026-11-20: "keep working as recommended through phase 6").

## Status

- [x] Spec, 2026-11-20 (V-182, V-183)
- [ ] Bundle 1, families
- [ ] Bundle 2, heat and the Hearths law
- [ ] Bundle 3, mason, lime and thatch; buildings grow
- [ ] Bundle 4, faith, shrines and feasts
- [ ] Bundle 5, the tavern, songs and bynames
- [ ] Bundle 6, apprentices, the schoolroom and callings
- [ ] 6B balance and review

## Design (VR-62)

Each system says what it owns, the lever it reuses, where its fact lives, how it fails, and the rule its test checks. Numbers come at each mock-up.

- **Families (P6.1, V-145, V-161).** Owns ages (a year a calendar year), courtship, marriage, births, death of old age and mourning; reads friends (who talked, `colony` elder), traits and homes. Two unwed adults who are close friends and like each other court; a marriage feast on the green, then the household asks for its own house through the house wants that exist (V-053). A child takes one parent's race and its pace from `races.json` and helps with small jobs (gathering, fetching water, herding) from a quarter of it; gifts and weaknesses inherit, close kin raise the odds of a weakness, with a "Born" line. Lever: none, nobody is ordered to marry (V-161). Fails: no friends, no births; a hungry winter delays births; old age and grief are memories. Test: a pair who talked for weeks marry with a feast line and their child's Born line names both parents.
- **Heat (P6.10, V-161).** Owns room air heat: a fire heats the air of its closed room, each wall material leaks it at its own rate (content), the room cools slowly after the fire dies, replacing today's instant room heat. Lever: a Hearths law (Frugal / Steady / Roaring) in `laws.json`, weighed like any law; a cold grumbler under Frugal may stoke their own hearth anyway, with a line. Fails: no firewood, the room cools at its walls' rate. Test: a stone room stays warm longer than a timber one after its fire dies.
- **Mason, lime and thatch; growth (P6.11, P6.9, V-052, V-096).** New trades as `jobs.json` rows on the Priorities sheet: the mason dresses stone and splits slate, the lime burner burns limestone in a kiln for mortar and limewash, the thatcher lays reed or straw roofs (roofs stop being free, V-056). Stages as `buildings.json` entries started from need: a room losing heat through timber asks for stone, thatch wears over years and asks for slate, a crowded workshop grows a lean-to, a busy forge grows larger. Lever: the Build sheet's wants and stock levels; nothing grows on a timer. Fails: each stage waits with a line naming the missing material or trade. Test: a slate stage waits for a mason's slate, with that line.
- **Faith and feasts (P6.8, V-143).** Owns each person's faith, from their culture in `faiths.json`. Once two share a faith they site a shrine on or by the green (V-050); the most devout is its priest under the faith's own title and leads rites on feast days. What a faith holds sacred or abhors leans law answers and can feed a faction. Feast days are proposed from the colony's own ledger (arrival, first harvest, a death); a Feasts law (Few / Customary / Many) trades food and work hours for mood; anniversaries return as memories. A grieving or devout colonist may live apart in a cell and is visited for blessings. Fails: a feast with an empty store is skipped with a line. Test: the shrine raises mood for the faithful, and the priest leads a rite.
- **Tavern, songs, bynames (P6.12, V-140, V-155, workshop proposal P3).** The tavern is a Build sheet want, sited by the colonists; the innkeeper and brewer are Priorities rows, and ale moves here from 5B (V-128). Once it stands most tales pass there in the evening (V-155). A bard makes a song of a big event and sings it in free time: mood, and its version spreads. When a tale about someone reaches most of the colony they earn a byname from its drifted version ("Idris Oat-thief"), shown after their name, unfair if the tale is. Fails: no ale, people still gather but stay shorter. Test: most tellings happen at the tavern once it exists.
- **Apprentices, the schoolroom, callings (P6.13, V-074, V-141, V-175).** Learning beside a master is faster than practice alone, and the ledger names who taught whom; children often take up a parent's trade. An Apprentices law (Every master takes one / By choice / None) each master weighs. The schoolroom is a Build sheet want: a teacher teaches children, a scribe copies a master's methods into a book, and a master who dies untaught and unwritten takes what only they knew. Callings are content entries with a high bar, at most one holder each and a line saying why: peacemaker, lorekeeper, master, champion (V-175). Fails: no master nearby, practice alone. Test: an apprentice beside a master levels faster than one alone.

Lever list (V-041): Hearths, Feasts and Apprentices laws; tavern and schoolroom on the Build sheet; mason, lime burner, thatcher, innkeeper, brewer, bard and teacher on the Priorities sheet. Nobody is told whom to marry, teach or follow; no tile or person is targeted.

## Milestones

One bundle builds while the next prepares (VR-68), each in a fresh thread. A bundle over 1,200 lines splits into engine and screen PRs (VR-58). check:full is about 103 s of 120 s: ten-year tables are mock-up and balance scripts, never tests.

### Bundle 1: families (P6.1)

Mock-up: Engine. Done when: ten years on four seeds in a table (marriages, births, deaths of old age), and the marriage-to-Born test above. Likely split: courtship and homes, then births and children.

- Reading list: `docs/DECISIONS.md` V-053 V-145 V-161 V-173; `src/engine/people/MODULE.md`; `src/engine/band/MODULE.md`; `src/engine/colony/MODULE.md`

### Bundle 2: heat and the Hearths law (P6.10)

Mock-up: Engine. Done when: a stone room keeps warm longer than a timber one after its fire dies, in a three-seed table; Hearths answers are law events.

- Reading list: `docs/DECISIONS.md` V-043 V-097 V-161 V-171; `src/engine/fire/MODULE.md`; `src/engine/needs/MODULE.md`; `src/engine/law/MODULE.md`

### Bundle 3: mason, lime and thatch; buildings grow (P6.11, P6.9)

Mock-up: Engine. Done when: the slate line test; over ten years each seed gains stages, each with a line naming its cause.

- Reading list: `docs/DECISIONS.md` V-052 V-056 V-096 V-097; `src/engine/build/MODULE.md`; `src/engine/crafts/MODULE.md`

### Bundle 4: faith, shrines and feasts (P6.8)

Mock-up: UI (shrine, faith line, Feasts row). Done when: the shrine and rite test; a feast day proposed from the ledger.

- Reading list: `docs/DECISIONS.md` V-050 V-143 V-161; `src/engine/law/MODULE.md`; `src/engine/needs/MODULE.md`; `src/ui/MODULE.md`

### Bundle 5: the tavern, songs and bynames (P6.12)

Mock-up: UI (tavern, songs in the ledger, bynames). Done when: a table of tellings by place before and after the tavern; a byname's line cites its tale.

- Reading list: `docs/DECISIONS.md` V-128 V-140 V-155 V-169; `src/engine/tales/MODULE.md`; `src/engine/build/MODULE.md`; `src/ui/MODULE.md`

### Bundle 6: apprentices, the schoolroom and callings (P6.13, V-175)

Mock-up: Engine (calling and teacher lines in the inspector). Done when: the apprentice table; the ledger names who taught whom; each calling's test meets its bar and shows its push.

- Reading list: `docs/DECISIONS.md` V-074 V-141 V-170 V-175; `src/engine/band/MODULE.md`; `src/engine/self/MODULE.md`; `src/engine/law/MODULE.md`

### 6B balance and review

The `balance-check` skill over ten years on four seeds, then the `phase-review` skill. Done when: every seed has a marriage, a birth and a grown stage by year 10, each explained.

## Phase done (playtest)

Skip ten years: a couple court, marry at a feast and raise a child who helps in a parent's trade; a timber house turns to stone after a cold winter and its thatch to slate with the mason's line; the faithful build a shrine and the priest leads a rite; most tales pass at the tavern and a song gives someone a byname; a master teaches an apprentice and one colonist takes a calling with its reason.
