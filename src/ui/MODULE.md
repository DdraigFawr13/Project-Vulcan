# ui

The page entry, panels, inspector, ledger browser and controls. Sends commands to the worker and shows snapshots and events.

- **Public API:** none; `src/ui/main.ts` is the entry `index.html` loads.
- **Rules:** never computes a game rule (GAME-02); everything shown comes from a snapshot or an event.
