# self

The self (P6.4, V-146, V-156, V-170): the roles each colonist sees themselves in, and the life ambition some hold. Both lean law answers and are named in the reasons.

- **Public API:** `index.ts`: `selfSystem`, `SELF_TABLES`, `rolesOf(world, person)` (strongest first), `ambitionOf(world, person)`, `ambitionText(content, row)` ("to learn crafting"), `practiceOf(world, content, person)` (the skill an unfinished masterwork or trade practises, and its line), `scoresOf(world, content, p)`.
- **Content:** `self.json`: `roles` (id, `name`, points from `traits`, `memories`, `skills`, `newcomer`, `refused`, `beliefs`), the dials `at`, `most`, `keep`, `skillStep`, `hour`; `ambition` (`checkDays`, `chance`, `every`, `memory`) and `ambitions` (`kind` master / learn / house, `skills`, `from`, `under`, `to`). Leans on laws are in `laws.json` settings `roles` and `ambitions`.
- **Roles (`roles.ts`, daily at `hour`):** points from traits, heavy and lasting memories (never light), one per `skillStep` levels of the best listed skill, coming as a newcomer, and beliefs at strength 2 or more. Roles from `at` points are held, at most `most`; a held one counts `keep` more. A change writes `self.role` citing the memory or belief behind the gained role, else the arrival line; the first day is quiet.
- **Ambitions (`ambitions.ts`):** every `checkDays`, someone with none takes one up at `chance` per cent from those that fit (master: potential `from`+; learn: level under `under`; house: no home of their own), `self.ambition`. Done when the skill reaches `to` or they have a home: `self.fulfilled` and the `memory`. One a life.
- **Practice:** people `evening.ts` `practising`: at leisure, one free minute in `every` goes to the ambition's skill.
- **Law:** law `weigh.ts` adds each held role's and an unfinished ambition's lean, words "sees themselves as …" and "wants …", and their lines in the reweigh signature.
- **State owned:** tables `role` (person, role, points, why, line, since) and `ambition` (person, ambition, skill, line, since, done).
- **Invariants:** reads traits, skills, memories, beliefs, answers and homes; writes only its own tables and the fulfilled memory. Must not import `people`. Whole numbers only.
- **Tests:** `self.test.ts` (two colonists, one law, two reasons; a heavy memory changes a role with a line citing it; a trade practised in leisure and fulfilled).
