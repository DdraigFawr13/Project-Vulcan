# content

Game data: the forked Story Generator raws plus Vulcan's own tiles, recipes, jobs and laws, with validators. Empty until P0.2.

- **Public API:** `src/content/index.ts` (from P0.2): the validated content and its `contentHash`.
- **Layout:** raw entries under `src/content/data/` (exempt from the 400-line cap); validators and schemas beside them.
- **Rules:** pure data, same purity rules as the engine; may import engine types. Threads read the schema and validator, not the entries.
