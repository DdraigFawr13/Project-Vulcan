# Ledger: concept

Morgan's concept draft from the Vulcan project chat, 2026-10-17, kept as written. Decisions taken from it are in [DECISIONS.md](DECISIONS.md); where they differ, DECISIONS wins.

## Premise constraint

No per-call API cost rules out a cloud model. Two ways to keep a model:

- **Local model via Ollama** (free after hardware; 7B-class models run on a mid-range GPU or Apple Silicon). Latency 1-5 s per call, acceptable only for off-critical-path calls.
- **No model at all**: Dwarf Fortress produces its depth entirely from rules; the model is used only at design time to write the trait tables, event grammars and dialogue templates.

Recommended: build for option two, with a model hook that is optional and asynchronous. The sim never waits on a model. If a local model is present, it enriches journals and speech; if absent, template text fills the same slots.

## Twist: colonists interpret you, not obey you

You issue laws and priorities and shape the environment. Every colonist holds a belief model of the laws (what they think the rule is, whether it is fair, who it favours) and of each other. Laws are enforced by colonists, not the engine. Outcomes depend on legitimacy, memory and faction, so the same law yields different results in year 1 and year 40. Depth comes from three stores per agent:

- **Memory ledger**: timestamped events with emotional weight that decays unevenly (grief slow, annoyance fast).
- **Belief graph**: opinions of people, laws and institutions; updated by witnessed events and by gossip (second-hand, lossy).
- **Narrative self**: a small set of identity claims ("I am the one who kept the granary") that bias action selection and resist contradiction.

**Levers**: law book (allocation, labour priority, punishment, succession), and environment (terrain edits, weather bias, arrivals, portents). No direct orders.

**Multi-generation from day one**: age, inheritance of beliefs and grudges, place-names and legends derived from the event log. Scaling is handled by aggregating agents outside the active region into statistical households.

## Architecture

- **Engine**: TypeScript, deterministic, seeded, fixed tick in a Web Worker. Real-time-with-pause maps onto a browser game loop; no server.
- **Viewer**: canvas tile map, inspector panel per colonist, pause and speed controls.
- **Data**: every event appended to an in-browser SQLite (sql.js) and exportable; charts in-page, deep analysis in Python/pandas on exports.
- **Repo**: Git; Claude Code builds and refactors; Supabase or Vercel only for later cloud saves.
- **Trade-off vs a Python engine**: Python is better for analysis, but real-time rendering in a browser from Python adds a server and a transport layer. Export files bridge the gap at zero complexity.

## Milestones

1. Tick loop, map, 10 colonists with needs and jobs, event log, pause/speed.
2. Memory ledger and belief graph; gossip; one law (food allocation) enforced by colonists.
3. Legitimacy, factions, punishment and defiance.
4. Aging, death, births, inheritance; legend generation from the log.
5. Aggregation for 60+; environment levers; optional Ollama hook.
