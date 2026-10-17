# <system>

<One line: what this system does, in player terms. The code map shows this line.>

- **Public API:** `index.ts` exports and what each is for.
- **Events:** types it emits; types it reads.
- **State owned:** the parts of game state only this system writes.
- **Invariants:** what is always true after it runs.
- **Tests:** the test files next to it and what they prove.

At most 40 lines (`npm run limits`). Update it in the same PR as any change to `index.ts`.
