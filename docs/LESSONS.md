# Lessons

One line per mistake. Read the entries for an area before working in it. When a mistake repeats, bump its count; at ×2 it also becomes a rule (in DECISIONS, AGENTS.md, or proposed to AI-Master-Instructions). Mark retired entries SUPERSEDED; never delete them.

Format: `- <area> · <mistake> · <root cause> · <rule> · ×<n> (<YYYY-MM-DD>)`

- tooling · `node .claude/master/sync.mjs` failed: "Remote branch v0.2.0 not found" · the master repo has no release tags yet · sync with `--source <master checkout>` until v0.2.0 is tagged · ×1 (2026-10-17)
- engine · Node's type stripping rejected a TypeScript parameter property in the copied RNG · strip-only mode supports erasable syntax only · `erasableSyntaxOnly` is on in tsconfig so scripts can import the engine directly · ×1 (2026-10-17)
