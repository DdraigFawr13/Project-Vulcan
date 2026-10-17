# persist

Saves in IndexedDB and the ledger download, on the main thread.

- **Public API:** `src/persist/index.ts`: `openSaves()` resolves to a `SaveStore` (`put(meta, save)`, `list()` newest first, `get(id)`, `remove(id)`) or rejects with a sentence the save panel shows; `AUTOSAVE_ID`; `download(name, text)`; types `SaveMeta`, `SaveStore`.
- **Storage:** database `ledger`, schema version 1, two object stores keyed by the same id: `meta` (`{id, name, seed, tick, savedAt, auto, thumbnail}`, read together for the list) and `saves` (the `SaveFile` records, read one at a time). Manual saves get a generated id (`save-<ms>-<uuid>`), never their name, so two saves on one game day are two saves; the autosave has the one slot `autosave`.
- **Errors:** no IndexedDB, a blocked open (another tab holding an older schema) or a full disk (`QuotaExceededError`) reject with a readable reason; the game carries on and the save panel shows it.
- **Rules:** a save is the worker's `SaveFile` (`src/worker/save.ts`: `{version, seed, params, contentHash, tick, state}`, the command log and ledger inside `state`); persist stores it as given and never checks or changes it: the worker checks it on load (ARCHITECTURE "Save").
- **Tests:** the browser smoke (save, reload the page, load, carry on); the record's round trip and refusals in `src/worker/save.test.ts`.
