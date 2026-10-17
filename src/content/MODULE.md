# content

Game data: the forked Story Generator raws plus Vulcan's own tiles, recipes, jobs and laws, with validators.

- **Public API:** `index.ts`: `content` (all files, typed and validated on load), `contentHash` (14 hex digits; changes when any entry does), `validateContent(files)` (one line per problem), `hashContent(files)`, `rawContent`, type `Content`.
- **Layout:** `data/<file>.json`, one list entry or top-level field per line (exempt from the 400-line cap and from Prettier). `schemas.ts` holds each file's shape, `schema.ts` the small schema language whose specs also give the TypeScript types, `validate.ts` ids, references and tier caps, `hash.ts` the fingerprint.
- **Fork:** `FORK.md` records the Story Generator commit and every change made since. `tools/fork-content.mjs` made the copy once; it refuses to overwrite `data/` without `--force`.
- **Adding content:** add the entry to its JSON file; a new field or file needs its spec in `schemas.ts` first. Read the schema, not the entries.
- **Rules:** pure data, same purity rules as the engine; may import engine types.
- **Invariants:** every file matches its schema; ids are unique per file; every reference names an existing id; every magic ability's damage, radius and uses fit the caps of the tier its power falls in.
- **Tests:** `content.test.ts`: the fork passes; a broken sample fails with one line per problem; tier caps; the hash changes with any entry.
