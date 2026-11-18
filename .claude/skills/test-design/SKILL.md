---
name: test-design
description: How to write, change and fix tests so they can fail, wait properly, run on real samples as well as built ones, don't pin one seed's accident, stay inside the project's time budget and don't hang or slow down in CI, for any language or test runner. Use when writing, changing, fixing or reviewing unit, golden, scorer or browser (Playwright) tests, when a check fails, hangs or runs slow, when changing the check script or CI's test steps, or when a check passes its time budget. Not for just running the tests.
---

# Test design

Browser (Playwright) tests also need [references/browser-tests.md](references/browser-tests.md): waits, locators, race-free reads and config.

Each item cites the lesson it comes from: `terra:14` is line 14 of project-terra's `docs/LESSONS.md`; `Vulcan`, `Story-Generator`, `controls-simulator` and `dfma` (dfma-review) are the other projects. Rule ids such as VER-04 are in the shared rules.

## Prove a test can fail

- Make a fix's test fail before the fix (controls-simulator `docs/AUDIT.md:24`).
- Plant a bug once in equivalence, golden and scorer tests and see them fail (controls-simulator:16).
- Run the old-code check in a full copy of the previous commit (code, config, the test and its data), and print the imported module's path to prove which code ran (dfma:29).
- Time responsiveness from outside the thing it watches (a heartbeat gap or the test's own clock), never inside the call a stall would delay (dfma:43).
- When a test changes, restate what it proves; never widen it (Vulcan:34, VER-01).

## Real samples, not only built ones

- Run new logic on the project's real sample files, not only on inputs built to show the feature; a rule fitted to built or generated inputs can break real ones (dfma:14, :27).
- Before a new finding or rule ships, list where it fires on every real sample and check each hit (dfma:30).
- After building a test input, measure that it is what it claims before scoring anything on it (dfma:23).
- Test one shape per kind that isn't the plain textbook case (dfma:17).
- Load-test with a full session's data (terra:9).

## Scorers and summaries

- Count every item that failed or timed out as a miss; never drop it from the totals (dfma:25).
- Report every result in a class the score leaves out, and ask what the scoreboard cannot see before quoting it (dfma:25).
- When the scorer changes, run every producer's output through it, one synthetic case each if needed (dfma:24).

## No hangs, same result in CI

- Set explicit per-test and per-run timeouts.
- Compare the local time with the last green CI step and keep a margin, because CI runners are slower (Vulcan:15).
- Pin the CI runner image along with the toolchain that must support it; move them together (dfma:13).
- Free the test port and stop leftover preview servers before a run (Vulcan:54).
- Treat a run that never exits as a failure to root-cause, never one to retry (VER-04).
- Start the first run of a slow or outside tool with a short timeout, and read its log within the first minute (dfma:36).

## Waits

- Wait for the state, never read it once (terra:14).
- Wait for the event, not a fixed count of days or skips (Vulcan:35, :46).
- A fixed wait is a wall-clock limit: under parallel lanes or a slower runner it fails (dfma:55). Mark such tests so they run alone (VER-11).
- Browser detail is in the reference, section "Waits".

## Properties, not one seed

- State the property, and search a seed list for a world that shows it (Vulcan:38).
- Compute expected digests at test time (Story-Generator:21).
- Cache by what the world is, not by file (Story-Generator:23).

## Time budgets

- Read the test time budgets in the project's AGENTS.md, and report the check time against them.
- Time a test on the real input before it joins the every-push check, and record the time beside it (dfma:42).
- Run steps that share no files or ports side by side, then wall-clock tests alone (dfma:52).
- Leave a core for each browser lane; count a parallel speed-up only after a CI run, because CI has fewer real cores (dfma:53).
- Share one stepped world per file, and move slow tests to a slow tier (Vulcan:39, :48, :70).
- Keep whole-ledger reads out of step loops (Vulcan:76).
- Time a long run after changing a hot loop, and profile before blaming CI (Vulcan:57, :73).
- Measure performance on a production build (VER-06).

## Long runs

- Print a line per item as it finishes, so progress shows and a stopped run keeps its results (dfma:54).
- Watch a long run on those lines, not on its final summary.

## Find the cause

- Reproduce the failure locally first, with the same filters CI uses (VER-02).
- When two runs differ on a few items, diff the inputs at the first branch where they split before suspecting the big component (dfma:50).

## Goldens and random ids

- Run a golden test twice before committing it, and give fixtures fixed ids (controls-simulator:17).
- Keep random ids out of text searches (terra:10).
- When a fixture switches off one effect, switch off every effect it isn't testing (Vulcan:74).

## Keyboard

- Test dialogs with the keyboard as well as the mouse (controls-simulator:46).
- When a control's box changes, measure its focus ring in a test; a clipping container hides it (dfma:47).

## The check script

- Before naming a test path in a spec or a brief, read which folders the check script and CI run (dfma:33).
- To run one test file by hand, pass the same marker or filter the check script uses; a file path selects every test in it (dfma:48).
- After editing the check script or the environment file, run it once from a fresh clone or fresh environment (dfma:10, :46).
- Read the check's last line before committing, with `set -o pipefail` on any filter and `&&` before the commit (dfma:22, VER-03).

## Before you push

- In JS and TS projects, run `node .claude/skills/test-design/scripts/test-traps.mjs` if the project's check doesn't already.
- Read every `warn test-traps` line (VER-03).
