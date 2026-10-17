# log

The ledger: writes every event with its causes, refuses ones content has no text for, and renders and exports them.

- **Public API:** `index.ts`: `emit(world, templates, type, fields)` appends `{id, tick, type, actors, subjects, causes, data}` to `world.log` and returns the id; `templatesOf(events)` builds the template map; `renderEvent(event, templates, nameOf?)` fills `{actorN}`, `{subjectN}` and data slots; `toNdjson(events)`; `findEvent(log, id)`; `whyOf(log, id, limit?)` (an event's causes and theirs, nearest first, each once with its depth: the inspector's "why?"); types `EventFields`, `Templates`.
- **Events:** writes whatever type it is given; reads none.
- **State owned:** `world.log` and `world.nextEventId`.
- **Invariants:** ids rise by one from 1; an event's tick is the world's tick; `emit` throws when the type has no template, a slot is left empty or a cause is not an earlier line, so every line can be shown as text and every "why?" ends at a real line.
- **Tests:** `src/engine/engine.test.ts` (the template check, rendered calendar lines, "why?" chains). Salvaged from PR #1's `core/events.ts` and `narrative/render.ts`.
