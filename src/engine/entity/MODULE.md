# entity

Entity tables: every person, item and later creature as a row of its kind, with one id counter for all kinds.

- **Public API:** `index.ts`: `addEntity(world, kind, fields)` returns the new id; `entityOf(world, kind, id)`; `removeEntity(world, kind, id)` (its id is never given out again); `tablesProblem(world, schemas)` (why the tables do not fit their declared fields, or undefined: the save check's generic part); `citedByEntities(world, schemas, into)` (the ledger ids rows cite, for the seal); types `FieldType` (`int`, `count`, `number`, `text`, `entity`, `event`, `events`), `TableSchema`, `Schemas`.
- **Events:** none; the systems that own the kinds write the lines.
- **State owned:** `world.entities` (rows by kind) and `world.nextEntityId`. A system declares the kinds it owns in its `tables`; `createSim` refuses a kind with two owners or a field named `id`.
- **Invariants:** rows are an array per kind in rising id order (iteration is by id, so it is the same on every run); ids are unique across kinds, so a ledger line's actors and subjects name one thing; every row has exactly its declared fields. Struct-of-arrays is not used: about 30 people and a few thousand items by year 10 (V-027) do not need it.
- **Notes for P2.1 and later:** a person who dies stays a row with a status field rather than being removed, so old lines can still name them; an item used up is removed.
- **Tests:** `src/worker/save.test.ts` (a test kind round-trips through a save; bad ids, values, kinds and extra fields are refused; a remembered line survives the seal as a stub).
