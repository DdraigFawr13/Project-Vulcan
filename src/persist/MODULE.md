# persist

Saves in IndexedDB and the ledger download, on the main thread.

- **Public API:** `src/persist/index.ts`: `openSaves()` resolves to a `SaveStore` (`put(meta, save)`, `list()` newest first, `get(id)`, `remove(id)`, `putSegments(items)`, `getSegment(key)`) or rejects with a sentence the save panel shows; `AUTOSAVE_ID`, `RESCUE_ID`; `gzip(text)`; `download(name, parts)` (strings and buffers joined into one file, never one string); types `SaveMeta`, `SaveStore`.
- **Storage:** database `ledger`, schema version 2 (P2.0 added `segments`; a version 1 database is upgraded in place), two object stores keyed by the same id: `meta` (`{id, name, seed, tick, savedAt, auto, thumbnail}`, read together for the list) and `saves` (the `SaveFile` records, read one at a time). Manual saves get a generated id (`save-<ms>-<uuid>`), never their name, so two saves on one game day are two saves; the autosave has the one slot `autosave`.
- **Ledger archive (P2.0):** `putSegments(items)` gzips each sealed day (`CompressionStream`) before its transaction and stores it under its key; `getSegment(key)` returns the gzipped bytes, which the export joins as they are (gzip members end to end are one gzip file); `gzip(text)`. Segments are immutable and keyed by content, so a branch played on from an older save adds new keys and never overwrites. Known gap: segments no save names stay until P10.2's save files add a clean-up (bounded by the 40 MB archive budget).
- **Rescue:** `put` with `rescue` set (the error text) writes the one `rescue` slot (`RESCUE_ID`).
- **Errors:** no IndexedDB, a blocked open (from schema 2 on: another tab holding the older one) or a full disk (`QuotaExceededError`) reject with a readable reason; the game carries on and the save panel shows it.
- **Rules:** a save is the worker's `SaveFile` (`src/worker/save.ts`: `{version, seed, params, contentHash, tick, state}`, the command log and ledger inside `state`); persist stores it as given and never checks or changes it: the worker checks it on load (ARCHITECTURE "Save").
- **Tests:** the browser smoke (save, reload the page, load, carry on); the record's round trip and refusals in `src/worker/save.test.ts`.
