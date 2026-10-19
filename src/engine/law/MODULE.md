# law

Laws the colony keeps and how each person answers them (P4.8, V-091): the work-hours law (Short days, Customary, Long days).

- **Public API:** `index.ts`: `lawSystem`, `LAW_TABLES`, `settingOf(world, content, law)`, `lawDef`, `lawRow`, `hoursOf(world, content, person)` (their own hours: the law's, or the customary ones when they refuse), `lawHours`, `customaryHours`, `hoursFor`, `isWinter`, `weigh(world, content, person, setting)` (willingness, answer, what weighed for and against, the memory lines), `leanOf(setting, memory)`, `WORK_HOURS`.
- **Lever:** `setLaw {law, setting}` (V-041: the only say; nobody is ordered). A new setting writes `law.set`, then everyone answers with `law.answered` (citing it and the memories that weighed); Customary clears the answers. A grumbler gains the setting's `grumbled` memory.
- **Weighing (content `laws.json`):** `start` − the setting's `ask` + (mood − half the scale) ÷ `moodPer` + `low` per low need + trait and memory leans + `winterLean` in winter; `obey` or more obeys, `grumble` or more grumbles, else refuses (keeps the customary hours).
- **Hours:** Customary is the colony's day (content `work.hours`; no lever changes it, V-099), in winter the custom's `winter` hours (V-092). Other settings have `hours` and `winter`. Bed stays at the colony's bedtime. people `mind.ts` reads `hoursOf` per person.
- **Hourly:** at the hour a refuser's day and the law's part (the customary end under Long, the law's end under Short), an awake refuser writes `law.keptCustom`; awake people on the same level within `sight` tiles, or in the same house, write `law.saw` and gain the setting's `saw` memory about them. Anyone holding a memory that weighs on the setting and not yet weighed answers again; a changed answer is a line (`now`). Grumblers' memory is refreshed at the law's end of day.
- **State owned:** tables `law` (law, setting, line, changed) and `answer` (person, law, answer, will, pro, con, cites, mems, line). No system state.
- **Invariants:** reads people rows, traits, needs, mood and memories; writes only its tables and memories through needs `addMemory`. No RNG.
- **Tests:** `law.test.ts` (two people answer the same law differently, each citing its memories; a refusal seen spreads a memory; Customary clears the answers; the warmth line moves with traits and memories).
