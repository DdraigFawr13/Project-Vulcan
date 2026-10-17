# engine

The pure, deterministic simulation: state, systems and the event log. Empty until P0.3.

- **Public API:** `src/engine/index.ts` (from P0.3).
- **Layout:** one folder per system (`src/engine/<system>/`), each with `index.ts` as its only public surface and its own `MODULE.md`. Systems import each other only through `index.ts`.
- **Rules:** no DOM, `Date`, `Math.random`, timers, I/O or transcendental `Math`; named RNG streams; every state change emits an event with causes (DECISIONS V-006). Enforced by `npm run boundaries`.
- **Tests:** next to the code; one determinism test for the whole engine.
