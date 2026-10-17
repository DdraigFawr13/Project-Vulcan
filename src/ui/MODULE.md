# ui

The page entry, panels, inspector, ledger browser and controls. Sends commands to the worker and shows snapshots and events.

- **Public API:** none; `src/ui/main.ts` is the entry `index.html` loads.
- **Files:** `main.ts` (worker, renderer, keys, message routing), `hud.ts` (clock with the level on screen, speed and panel buttons, readout, the level control above the zoom buttons, the not-reached note, screens), `panel.ts` (the side panel, a bottom sheet under 640 px wide: tile inspector, ledger with "why?", save list with New game), `saves.ts` (saving, loading, autosave, export download, the ledger's newest 200 lines), `dom.ts`.
- **Levels:** ▲ and ▼ (or `<` and `>`, PageUp and PageDown) step the view between the surface and the four levels below; taps inspect the level on screen. The tile panel's "Cut stairs down" and "Sink a shaft" buttons send the map's test orders for the next tick (they wait while paused) until colonists can dig.
- **Weather (P1.4):** the clock line adds the day's weather ("Winter · A blizzard blows, -7 °C"); the inspector adds the tile's temperature, ice and aura with the spot that gives it.
- **Seed:** the URL's `?seed=` (default `ledger-1`); the save panel's New game field reloads the page with a new one.
- **Saves:** "Save now" and the autosave ask the worker for a `saved` record, add a name (seed and game date) and a thumbnail, and write it through persist. The autosave runs every 60 s of real time while the game runs and when the tab is hidden, into one slot, and skips if no tick has passed since the last one or since the world began or was loaded (so a fresh or just-loaded world never replaces it). Load pauses, sends the record to the worker and shows a loading screen; `ready {from: 'save'}` ends it, `loadRefused` shows the reason with the game paused behind it; closing it restores the speed.
- **Rules:** never computes a game rule (GAME-02); everything shown comes from a snapshot, an event line or a worker answer. Typing in the seed field is not a game key; Escape closes the panel.
- **Tests:** the browser smoke (inspector, "why?", save, reload, load, export).
