# calendar

The valley's calendar in the ledger: a line for each new day, month and season.

- **Public API:** `index.ts`: `calendarSystem`, run daily at midnight.
- **Events:** emits `calendar.day` (cites its month line, or `world.begun` in the first month), `calendar.month` (cites `world.begun`) and `calendar.season` (cites its month line); reads none.
- **State owned:** `world.systems.calendar.monthEvent`, the current month line's id.
- **Invariants:** the first of a month gets a month line instead of a day line, and the world's first month and season get theirs in `init`; a season line follows the month line that opens a season; any "why?" reaches `world.begun` in at most two steps. Month and season names come from `content.calendar`.
- **Tests:** `src/engine/engine.test.ts` ("writes the calendar lines").
