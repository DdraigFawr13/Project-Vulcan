---
name: refactor
description: How to keep code easy to change from the first commit, and how to plan and run a refactor safely and cheaply, for any language. Covers module shape, one home per helper, file and contract size limits checked by script, choosing targets by churn x size, pinning behaviour before moving code, small refactor-only commits, and a plan template. Ships `hotspots.mjs`, which ranks files by churn x size, lists oversize files and finds helpers copied into several files. Use when starting a codebase or a new module, before adding a helper, when a file passes its size limit, when asked to refactor, clean up, simplify, split a file, cut duplication or speed up development, or when a feature is hard to add because of the code's shape. Not for a one-line fix or for changing what the code does (do that in its own commit after the refactor).
---

# Refactor

Two jobs: build so the code stays cheap to change (part A), and when it isn't, refactor in small proven steps (parts B to D). A refactor changes structure, never behaviour: "the system is kept fully working after each refactoring" ([refactoring.com](https://refactoring.com/)).

Each item cites its source. `terra`, `Vulcan`, `Story-Generator` (`SG`) and `adventure-manager` (`AM`) are Morgan's projects; `SG #80` is a PR, `Vulcan:53` a line of that repo's `docs/LESSONS.md`. Outside sources are linked once in `decisions/research/2026-11-19-refactoring.md` of AI-Master-Instructions. Rule ids such as VER-10 are in the shared rules.

Script: `node .claude/skills/refactor/scripts/hotspots.mjs [--since=6.months] [--top=15] [--max-lines=400] [--max-bytes=16384] [--json]`, run from the project root. Report only; it always exits 0.

## A. Build it right from the start

Agents read code in pieces and pay for every byte they load. Shape the code so the piece they need is small, named and has one home.

1. **One folder per system, one public entry.** Each system exports through one `index` file; other systems import only that. Check it with an import-boundaries script (Vulcan `tools/check-boundaries.mjs`, adapted from SG `scripts/check-boundaries.mjs`).
2. **A short contract per module.** A `MODULE.md` (or the entry file's header) says what the module does and its public API, and is updated in the same PR as any API change (Vulcan VR-44, VR-45). Cap it in bytes as well as lines: Vulcan's `src/ui/MODULE.md` kept its 40-line cap at 13,174 bytes because each line grew (measured 2026-11-19; this repo hit the same with HANDOFF, D-055). Keep it to what a reader needs to change the code; link data and tests, don't restate them (Vulcan:40).
3. **Files a reader can load whole.** Set a file limit in lines and bytes and check it by script (Vulcan `tools/check-limits.mjs`, 400 lines). Split by responsibility, not to dodge the number: 16 of Vulcan's 506 `src/` TypeScript files sit at 380-400 lines, which suggests packing to the cap (inference). Data files can be exempt.
4. **One home per helper.** Before writing a small helper (`clamp`, `isObject`, `capitalise`, `nameOf`), search the project for it (`grep -rn "function clamp\|const clamp" src`) and import the existing one. Agents re-create helpers locally: SG #80 and #144 each removed copies, and on 2026-11-19 `hotspots.mjs` still found 18 names with identical copies in SG (`liveCiv` in 10 files, 5 identical), 23 in Vulcan, 8 in AM (`capitalise` identical in 4 files, none exported) and `isObject` in 5 terra files. Run the script before a PR that adds helpers.
5. **One definition per rule of the domain.** When two places must agree (what "reachable" means, how the table is drawn), make one function both call. Vulcan:53: two readings of "reachable" drifted and colonists stood idle; terra AUDIT-2026-10-28 P1.3: one draw function so the preview can't drift from the projector.
6. **Design the state model before the second feature needs it.** Decide how state changes (for example commands, `apply(state, command)`) while it is cheap, not after hand-written field checks spread (terra AUDIT-2026-10-28 P1.4).
7. **No abstraction before its second use.** Write the interface and contract first, then the code; add a layer, option or interface only when a second caller exists (Vulcan VR-48; Fowler, YAGNI). Reviewers always find something; fixing every finding grows extra layers (Claude Code best practices).
8. **Tests next to their code, fast, and not pinned to one seed's accident.** Related tests only while iterating; a suite that pins one seed re-breaks on every change (SG:21 cost 6-19 min per build thread). Use the `test-design` skill (VER-10).
9. **Small PRs.** Split work estimated over 1,200 lines into an engine PR and a screen PR (Vulcan:18, VR-58). Google: about 100 lines is reasonable, 1,000 usually too large.
10. **Status and facts in one place** (SRC-01; Vulcan:16).
11. **A code map that is generated, never hand-written** (Vulcan `npm run codemap`, `docs/CODEMAP.md`): one line per folder with its exports, so a session finds the module without reading code.

## B. Choose what to refactor

Refactor where the next work goes, not where the code is merely ugly (Fowler, preparatory refactoring: "make the change easy, then make the easy change").

1. Run `hotspots.mjs --since=6.months`. Hotspots are files changed often and large (Tornhill: commits x lines; lines predict about as well as complexity metrics).
2. Read the three sections:
   - **Hotspots:** the top files cost the most per change. A top file that is also oversize is the first candidate.
   - **Oversize:** files over the limit. Split only those that change; a large file nobody touches costs little.
   - **Duplicate helpers:** names with identical copies first. Check each by eye: a copy that must stand alone (a synced script, a fixture, a script shipped to other repos) stays, and the plan says why.
3. Cross the list with the plan's next milestones. A target that the next feature touches comes first.
4. Pick at most three targets per plan. More is a rewrite.

## C. Plan it

Write the plan as `docs/refactor/YYYY-MM-DD-<area>.md` and publish it as a page for the owner (WS-08). The owner approves the plan before the first move (WS-02).

```markdown
# Refactor: <area> (YYYY-MM-DD)
Status: Proposed
Why now: <the feature or cost it unblocks; hotspots.mjs numbers>
Targets: 1. <file or helper> — <problem, measured> → <end shape>
Behaviour proof: <tests, goldens or digests that must stay identical; how they were shown to fail>
Steps: one line each, each a green commit (≤ ~300 changed lines)
Out of scope: <behaviour changes found on the way go to a follow-up>
Done when: <hotspots numbers after>; checks green; MODULE.md and CODEMAP updated
```

## D. Do it safely

1. **Pin behaviour first.** If the code has no test for what you move, add characterization tests that assert today's output (Feathers), or compare a golden output byte for byte. SG #80 proved "behaviour unchanged" with a 10-seed baseline regenerated byte-identical and unchanged SMOKE digests. Plant a bug once and see the pin fail (VER-10).
2. **One hat at a time.** A refactor commit changes no behaviour and no test expectation. A bug found on the way gets a note and its own commit or PR after the refactor (Fowler, two hats; Google small CLs; Beck, *Tidy First?*). If a test must change, the change is not a refactor: stop and say so.
3. **Small steps, green after each.** Move, rename or extract one thing, run the related tests, commit (GIT-05). Run the full check before each push (VER-02).
4. **Move, don't copy.** Extracting a helper means deleting every copy and importing the one home in the same commit; rerun `hotspots.mjs` to show the count fell.
5. **Big changes go in shards or behind a seam.** Swap a large part through an interface both versions implement (branch by abstraction) or route callers to the new code one at a time (strangler fig). Never a big-bang rewrite. Each shard merges on its own.
6. **Delegated refactors return evidence.** An agent's refactor counts only with the command it ran and its output; unchecked AI refactors were correct 37% of the time in CodeScene's 2024 benchmark. Review the diff (DEL-05) and re-check the lines the fix added (VER-08).
7. **Keep observable behaviour, not just the documented API.** Output text, order, file names, save formats and timing are depended on (Hyrum's law). Saved files must still load.
8. **Update the contract and map in the same PR** (A2, A11), and record measured before and after: file sizes, hotspot scores, copies removed, test time (SG #144: unit tests 57 to 46 s after removing duplicate determinism tests).

## Avoid

- A refactor PR that also changes behaviour, or edits a test's expected value.
- Splitting a file only to pass the line cap: the new files must each have one job.
- A new wrapper, layer, option or interface with one caller.
- Refactoring code no upcoming work touches.
- A long-lived refactor branch: merge each green step (GIT-01, DORA small batches).
- Trusting "no behaviour change" without a pin that was seen to fail.

## Before you push

- [ ] `hotspots.mjs` run; copies the change added: 0; copies removed listed.
- [ ] Refactor commits change no test expectations; behaviour commits are separate.
- [ ] Changed files are under the project's line and byte limits.
- [ ] MODULE.md and the code map match the new shape.
- [ ] Before and after numbers in the PR body, each from a tool's output (REP-01).
