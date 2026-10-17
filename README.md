# Project Vulcan: Ledger

A browser-only colony sim in the Dwarf Fortress spirit, where colonists interpret your laws rather than obey them. See [docs/CONCEPT.md](docs/CONCEPT.md) for the design and [docs/HANDOFF.md](docs/HANDOFF.md) for where it stands.

## Run it

```bash
npm ci
npm run dev        # http://127.0.0.1:5173/?seed=vulcan
npm run run-sim -- --seed vulcan --days 10
npm run check      # format, typecheck, boundaries, unit tests, build
npm run test:browser
```

Node 24.19.0 and npm 11.9.0 (`.nvmrc`, `packageManager`).

## Controls

Space pauses, 1-4 set the speed (1×, 2×, 5×, 10×), "Step 1 h" advances one game hour while paused. Click a colonist on the map or in the list to inspect them. "Export log" downloads every event as NDJSON for `pandas.read_json(path, lines=True)`.
