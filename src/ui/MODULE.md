# ui

The page entry, panels, inspector, ledger browser and controls. Sends commands to the worker and shows snapshots and events.

- **Public API:** none; `src/ui/main.ts` is the entry `index.html` loads.
- **Files:** `main.ts` (worker, renderer, keys, message routing), `hud.ts` (clock, speed and panel buttons, readout, screens), `panel.ts` (the side panel, a bottom sheet under 640 px wide: tile inspector, ledger with "why?", save list with New game), `saves.ts` (saving, loading, autosave, export download, the ledger's newest 200 lines), `dom.ts`.
- **Seed:** the URL's `?seed=` (default `ledger-1`); the save panel's New game field reloads the page with a new one.
- **Saves:** "Save now" and the autosave ask the worker for a `saved` record, add a name (seed and game date) and a thumbnail, and write it through persist. The autosave runs every 60 s of real time while the game runs and when the tab is hidden, into one slot, and skips if no tick has passed. Load pauses, sends the record to the worker and shows a loading screen; `ready {from: 'save'}` ends it, `loadRefused` shows the reason and restores the speed.
- **Rules:** never computes a game rule (GAME-02); everything shown comes from a snapshot, an event line or a worker answer. Typing in the seed field is not a game key; Escape closes the panel.
- **Tests:** the browser smoke (inspector, "why?", save, reload, load, export).
