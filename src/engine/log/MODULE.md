# log

The ledger: writes every event with its causes, refuses ones content has no text for, and renders and exports them.

- **Public API:** `index.ts`: `emit(world, templates, type, fields)` appends `{id, tick, type, actors, subjects, causes, data}` to `world.log` and returns the id; `templatesOf(events)` builds the template map; `renderEvent(event, templates, nameOf?)` fills `{actorN}`, `{subjectN}` and data slots; `toNdjson(events)`; types `EventFields`, `Templates`.
- **Events:** writes whatever type it is given; reads none.
- **State owned:** `world.log` and `world.nextEventId`.
- **Invariants:** ids rise by one from 1; an event's tick is the world's tick; `emit` throws when the type has no template or a slot is left empty, so every line can be shown as text.
- **Tests:** `src/engine/engine.test.ts` (the template check, rendered calendar lines). Salvaged from PR #1's `core/events.ts` and `narrative/render.ts`.
