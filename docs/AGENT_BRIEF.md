# Agent brief

One page. Everything else is read only at the section a reading list names.

## Rules that bind

- **No code before approval.** The project plan is approved; each phase spec (`docs/phases/PHASE_N.md`) is approved by Morgan before its code, and each milestone's mock-up before its build (RULES VR-18, `mockup-round` skill).
- **Engine purity** (V-006): no DOM, `Date`, `Math.random`, timers, I/O or transcendental `Math` in `src/engine` or `src/content`; named RNG streams; every state change emits an event with causes.
- **Indirect control** (V-015, V-019): no command moves, drafts or targets one colonist.
- **Content over code** (V-007): a new item, law or creature is a data entry.
- **Read in pieces** (VR-42 to VR-45): read `MODULE.md` contracts, not neighbours' code; system folders are imported only through `index.ts`; files under 400 lines.
- **Lean tests** (VR-21 to VR-27): one determinism test, boundary tests of player-visible rules, one browser smoke, seed lists instead of pinned seeds.
- **Ask on design forks** (VR-13); pick small defaults and say which (VR-14).
- **Anything Morgan reads** goes out as an artifact page too (VR-41).

## How work flows

1. The coordinator starts one thread per milestone and names its phase spec and milestone.
2. The thread reads AGENTS "Start here", then the milestone's reading list, and logs its setup time (VR-46).
3. Mock-up round, Morgan's approval, build on a branch from `main`, `npm run check` and the browser smoke locally, draft PR (no CI runs on drafts, VR-54).
4. Review (`reviewer`, plus `design-reviewer` for engine or content diffs) and fixes while still a draft; tick the milestone in the spec; mark ready, which runs CI once; squash-merge; the branch is deleted.
5. After merge: update the project plan's phase table and add the thread-times line. The CHANGELOG line goes in the PR.
6. After a phase's last milestone: the `phase-review` skill, then hand the phase to Morgan.

## Handoffs

Delegate only when it is cheaper (VR-51): over about 30k tokens of reading or output, over about 150 lines of spec'd code, or parallel work. Agents and when to use them: `docs/TOOLKIT.md` §2. Every brief names its reading list and asks for a capped report.

## Budgets (log overruns as OVER, VR-47)

Setup 10 min and 60 KB before the first edit; session hook 2 min; `npm run check` 60 s; a test file 2 s; CI 5 min; a milestone reading list 80 KB (`npm run reading-cost`).

## Where things live

- Project plan, phase table and phase files: `/mnt/project-files/vulcan/plan/` (`PLAN.md`, `phases/`), shown to Morgan at https://claude.ai/artifact/Q3ThVcMaFpecSKWa86jvZ9.
- Thread-times log: `/mnt/project-files/vulcan/process/thread-times.md`.
- Mock-up and art sources: `/mnt/project-files/vulcan/<milestone>/`.
- Code map: `docs/CODEMAP.md`. Module contract template: `docs/templates/MODULE.md`.
- Deploy: Vercel from `main` only (V-018); after a merge, check the live deploy is the merge commit (CI-05).
