# Vulcan working rules

Set by Morgan 2026-10-17. These sit on top of the shared AI-Master-Instructions rules (synced into the repo as `.claude/master/RULES.md`); where a shared rule already says it, the id is given instead of a copy. Ids are stable: never renumber or reuse one; retire a rule as `SUPERSEDED by <id>: <reason>`. This file is their home from the repo setup PR on. `PLAN.md` below means the project plan in the project files (`/mnt/project-files/vulcan/plan/PLAN.md`); its §4 is the pickup protocol and §6 the efficiency budgets.

## 1. Delegation

- **VR-01** Routine work goes to cheaper agents: spec'd coding to the Sonnet `implementer`, long check runs (multi-seed balance, sweeps) to the Haiku `test-runner`, broad searches to a Haiku Explore agent, red CI to `ci-fixer` (DEL-03).
- **VR-02** The main session keeps the design decisions, questions for Morgan, architecture, reviews, commits and merges (DEL-01).
- **VR-03** Run quick checks and small edits directly; a cold agent costs 20 to 60k tokens to read in (DEL-02).
- **VR-04** Every brief is self-contained: goal, files, rules that apply, done criteria, commands, "do not commit", report length (DEL-04). Every delegated diff is reviewed before it is committed (DEL-05).

## 2. Review before Morgan sees it

- **VR-05** Each milestone PR gets a review by Claude (the `reviewer` agent for diffs over about 500 lines) before merge; findings are fixed or answered in the PR.
- **VR-55** Every mock-up, UI or engine, gets the coordinator's review pass: the thread posts only a one-line "ready for review pass", waits for the coordinator's note, applies its findings and republishes (Morgan, 2026-10-17; LESSONS 2026-10-17). A UI mock-up then goes to Morgan on an approval card. An engine mock-up goes straight to its build after the pass, and Morgan sees its results at the phase playtest (Morgan, 2026-10-18 audit); a card is still posted for any fork that changes what Morgan sees. PRs don't get this pass: they keep the thread's own review and full local check, so CI runs once (VR-54). Narrowed by VR-59 (2026-10-18): engine mock-ups no longer get the pass.
- **VR-06** When a phase's last milestone merges, Claude runs a phase review on `main`: play the phase's playtest itself on the production build, read the phase's whole diff for bugs and rule breaks, and check every milestone's "done when". Fixes go in one follow-up PR.
- **VR-07** Only after those fixes merge does the phase go to Morgan, as one message: what to try, a link to the live build, screenshots as an artifact, and what is known to be rough. Morgan's findings come back as the next PR, and each correction Morgan makes is logged in LESSONS.md.

## 3. A clean, efficient repo

- **VR-08** One branch per milestone, cut from the latest `main`; one PR per branch; squash-merge on green CI (GIT-01, GIT-05).
- **VR-09** Merged branches are deleted at once: GitHub's auto-delete setting on, plus the synced prune workflow. A branch is never reused after its merge (GIT-02).
- **VR-10** No build output, reports, scratch files, worktrees or secrets in git; `.gitignore` covers them (DEL-06, SAFE-02).
- **VR-11** No new runtime dependency without asking (SAFE-03). Delete code a change makes dead in the same PR.
- **VR-12** CI runs only on PRs and `main`, cancels superseded runs, and stays under 5 minutes (CI-06).

## 4. Asking

- **VR-13** When the direction is unclear, or Claude is not sure exactly what Morgan wants, ask before building. One question at a time, with short options and a recommendation, on a decision card (WS-03).
- **VR-14** For small forks that do not change what Morgan sees or the plan, pick the reasonable default, say which, and keep going (WS-02).
- **VR-15** Never invent a mechanic or a fact about the world to fill a gap; ask, or label it an assumption (WS-06).

## 5. Plan and status

- **VR-16** The plan lives in the project files at `vulcan/plan/PLAN.md` and is updated there whenever a milestone merges or the plan changes. Decisions, architecture, rules, lessons, toolkit and art plan live in this repo's `docs/`; the plan links to them rather than copying them (SRC-01).
- **VR-17** Milestone status lives in the repo's `docs/phases/PHASE_N.md` Status section; phase status lives in PLAN.md's phase table. Both are updated in the same turn as the merge.
- **VR-18** No code for a phase before its spec is approved, and none at all before the plan is approved (LESSONS 2026-10-17).
- **VR-62** Every new system in a phase spec answers five design questions before its mock-up: what it owns, reads and gives; which existing lever it reuses before adding one; where each fact lives once; how it fails (supply, starvation, night, waste); which rule a test can check (Morgan, design workshop 2026-10-18).

## 6. Images, mock-ups and documents

- **VR-19** Every mock-up, screenshot, art sheet and map render is published as an artifact that reads on a phone (fits a narrow screen, no hover-only content) and linked in the thread. The source image is also kept under `vulcan/<milestone>/` in the project files.
- **VR-41** Anything Morgan needs to read (plans, rules, specs, reports, reviews) is published as an artifact page as well as kept as a file; Morgan can't open .md files on a phone. Republish the page to the same link whenever the file changes (LESSONS 2026-10-17).
- **VR-20** Look at every UI result before calling it done (VER-06); the artifact is the evidence.
- **VR-56** Each phase starts with a taste board: three or four reference pictures for the phase's look, which Morgan picks from before the first mock-up, so mock-ups aren't reworked as taste shifts (Morgan, 2026-10-18 audit; P1.1 took four rounds).
- **VR-57** Phone first: every UI mock-up and screen is designed at phone width (390 px) first, then desktop (V-029).
- **VR-58** A milestone whose build is estimated over 1,200 lines (code, tests, docs and data, not packed art) is split before the build into an engine PR and a screen PR, each merged on its own green CI (LESSONS 2026-10-18; P1.1 and P1.5 went over 1,500).
- **VR-59** The coordinator's review pass covers only screen mock-ups and taste boards, never engine mock-ups, and a screen pass is a spot check against the phase spec and the taste-board picks, not a full audit (Morgan, 2026-10-18; each pass cost about 70 to 105k tokens, four in Phase 2 so far).
- **VR-60** A mock-up is text plus two or three images and a three-seed table; the ten-seed done-when table is produced only by the phase review (Morgan, 2026-10-18; ten-seed galleries made mock-ups slow to build and large to review).
- **VR-61** Small milestones that touch the same area run as one bundle in one thread, so repo setup and spec reading are paid once; the coordinator names the bundle when it starts the thread (Morgan, 2026-10-18; each setup is roughly 150 to 250k tokens, estimated).

- **VR-64** Screen mock-ups word their buttons, alerts, empty sheets and "why?" lines with the `design:ux-copy` skill; Vulcan's voice stays in UI_STYLE and VR-37 (Morgan, skills review 2026-10-19).
- **VR-65** Every screen mock-up passes an accessibility check at 390 px before its spot check: text contrast 4.5 to 1, control contrast 3 to 1, the 44 px tap-target floor in UI_STYLE (V-077), and colour never the only signal (VR-37). It comes from the `design:accessibility-review` skill, narrowed to what fits a phone game, and is built once as a Playwright script (VR-53); until the script exists, the thread checks these four by hand (Morgan, skills review 2026-10-19).

## 7. Lean testing

- **VR-21** One determinism test for the whole engine (same seed and commands, same log), not one per system (GAME-06).
- **VR-22** Unit tests cover rules with an outcome a player would notice, at a system's boundary, not its internals. Content entries are checked by validators, not one test each.
- **VR-23** One browser smoke test: the game boots, runs, saves and reloads. New browser tests only for a bug that reached Morgan.
- **VR-24** A test that needs an example event searches a fixed seed list instead of pinning one seed; expected values are computed at test time, never hand-saved (Story Generator LESSONS 2026-10-16).
- **VR-25** Budgets: the checks as in VR-67, CI under 5 minutes. A change that breaks a budget removes or merges tests before it adds more. When a new test covers an old one, delete the old one.
- **VR-26** Each bug fix adds one regression test at the level where the bug lived, and no more.
- **VR-27** While iterating, run only the related tests; the quick check before each push (VER-02), the full one before ready (VR-67).
- **VR-67** Two check tiers (Morgan, 2026-10-19; the check had reached 63 to 70 s). `npm run check`, under 40 s, leaves out the slow colony-run test files listed in `vitest.config.ts`; run it on every push. `npm run check:full`, under 120 s (raised from 75 s, Morgan, 2026-10-25, V-137), runs every file; run it and the browser smoke once each before marking ready, and CI runs it. A test that steps a colony for weeks goes on the slow list.
- **VR-63** A browser-smoke locator names the exact row it means by its label (the Food need, not the first `.need`), never the first match of a class or button name (LESSONS "test" x2).

## 8. Design rules for this game

- **VR-28** Indirect control only. The player acts through priorities, standing orders (such as how much of a good to keep), laws, what to build and nudges; colonists choose where to cut, build and stack, and where each building goes (V-049). Levers nudge, never command (V-041, Morgan's wording). No lever moves, drafts or targets one colonist, or marks a tile to work, including in combat (V-015). Direct tools exist only in a TEST MODE row behind `?debug` (Morgan, 2026-10-18).
- **VR-29** Every consequence is visible and traceable. Each state change a player would read or trace is an event with its causes (DECISIONS V-036: moves, need decay and work progress are not); the inspector can walk any number, mood or item back to them (GAME-04).
- **VR-30** Content over code. A new item, crop, law, creature or spell is a data entry; an engine special case for one entry is a design smell to raise, not to ship (GAME-04).
- **VR-31** One mechanism per idea. Warmth, mood, quality and legitimacy each have one system that every feature feeds, never a parallel one bolted on (WS-05).
- **VR-32** No gamey shortcuts: no teleporting items, no free resources, no events without a cause in the world. If it would not happen in the valley, it does not happen in the game.
- **VR-33** Simulate what the player can see or what feeds something they can see. Anything else is aggregated or left out until it matters.
- **VR-34** Failure is a story. A colony may fail, but the ledger must explain why in the player's terms; a death or collapse with no readable cause is a bug.
- **VR-35** Magic stays rare and costs something. A feature that makes casters common or casting free needs Morgan's approval.
- **VR-36** Pause is a full tool: everything is inspectable while paused, and no information is shown only while the game runs.
- **VR-37** Readable at a glance: art reads at 32 px, colour is never the only signal, text uses plain words, and every alert names who, what and where.
- **VR-38** Performance is a design constraint: the full map (150 by 150 by 5 levels) with about 30 colonists (V-027) holds 60 fps at 3x on the production build. A feature that breaks it is not done.
- **VR-39** Determinism is sacred: engine code obeys V-006, and any new randomness gets its own named RNG stream.
- **VR-70** Nothing built may seal what the green reaches (LESSONS x2: a wood yard sealed the pasture gate; a house sealed the granary door). Every siting of a store, house or other walled building runs `shutsOff` (build `site.ts`) before it is planned.
- **VR-71** Carrying a surplus is a last-resort job (LESSONS x2: a log surplus kept the band hauling all year; a turnip heap past its plate stopped all building on anvil). Goods past their plate are hauled only by someone with nothing else to take up, after the Work-sheet loop; a year run counts unbuilt plans by day 200.

## 9. Lessons

- **VR-40** Each mistake Morgan corrects becomes a dated one-line entry in LESSONS.md: area, mistake, root cause, rule, count. At a count of 2 the rule also goes into this file (SRC-05).

## 10. Efficiency

- **VR-42** A thread reads only what its work needs: PLAN.md §1, §2 and §4, its own phase file and the parts it names, RULES, LESSONS, then the repo's AGENT_BRIEF, CODEMAP and the milestone's reading list. Never the whole plan or the whole codebase (PLAN.md §4).
- **VR-43** Every brief for a thread or agent names its phase file, milestone and reading list, so nobody searches for where to start.
- **VR-44** Code is built to be read in pieces: one folder per system, `index.ts` as its only public surface, a `MODULE.md` contract of at most 40 lines kept current in the same PR as any API change, files under 400 lines (PLAN.md §6).
- **VR-45** Read a neighbouring system's `MODULE.md`, not its code. Needing its code is a sign the contract is missing something; fix the contract in the same PR.
- **VR-46** Setup time is measured on every thread and logged in `vulcan/process/thread-times.md` at merge. Budgets: 10 minutes and 60 KB read before the first edit, 2 minutes for the session hook, the checks as in VR-67, 2 s per test file, 5 minutes of CI (PLAN.md §6).
- **VR-47** Going over a budget is flagged, never absorbed: say the number in the delivery reply, add a LESSONS line with the cause, and fix the cause by the phase review at the latest.
- **VR-48** Efficient programming: write the interface and the `MODULE.md` first, then the code; no abstraction before its second use; bulk code goes to the `implementer` with the reading list in its brief (VR-01).
- **VR-49** Efficient testing from day one: tests next to their code, the related tests only while iterating (`npx vitest related <files>`), the slow-test flag on, and a test removed when a newer one covers it (VR-21 to VR-27).
- **VR-50** Docs every thread reads stay small: AGENT_BRIEF under 6 KB, each plan phase file under 4 KB, each repo phase spec about two pages (9 KB), LESSONS one line per entry. `npm run limits` enforces the repo's limits.
- **VR-51** Hand off to an agent only when it is cheaper than doing the work directly: over about 30k tokens of reading or output, over about 150 lines of spec'd code, or work that runs in parallel. Checks under a minute and fixes under about 30 lines stay in the main session ([TOOLKIT.md](TOOLKIT.md) §1).
- **VR-52** Log each handoff (agent, tokens, minutes, rework needed) in the thread-times line. An agent or skill that costs more than the direct route, or needs rework twice in a phase, is changed or dropped at the phase review (DEL-07).
- **VR-53** Deterministic chores are scripts, not agents or skills.
- **VR-54** No GitHub Actions minutes before a branch is ready to merge (Morgan, 2026-10-17). PRs open as drafts; CI is skipped on drafts and runs once when the PR is marked ready for review. Run the checks locally instead (VR-67). Mark a PR ready only when nothing more is planned for it, and batch any fixes after that into one push (CI-02, GIT-05).
- **VR-66** Three new skills are on trial (the reviewer trial is done: TOOLKIT §3) and stay only if they are measured cheaper or equal at the same quality (DEL-07, VR-52): the `shepherd:reviewer` at the Phase 3 phase review, run on the same diff beside `reviewer` and `design-reviewer` in branch mode (its PR mode needs the GitHub command line), with findings and tokens compared; `shepherd` while coding, logged in one milestone's thread-times line (loaded or not, what it changed, tokens); and `setup-audit`, run once at project scope for readiness and cost. Each result goes in TOOLKIT §3 (Morgan, skills review 2026-10-19).
- **VR-68** Bundles overlap (Morgan, 2026-10-19): when a build starts, the coordinator starts the next bundle's thread, so its mock-up and approval happen meanwhile; one builds and one prepares at most. If the earlier bundle has not merged, the next keeps a draft, then merges `main` and re-runs the full check before ready.
- **VR-69** Cut each build into even slices of about 20 to 30 minutes (estimated), run as parallel helpers in worktrees (DEL-06), merged one at a time (GIT-04); split a slice that overruns, and log slice minutes (Morgan, 2026-10-19).
