---
name: balance-check
description: Time-boxed balance or tuning pass for Vulcan - one question, at most 15 minutes or three runs, on picker valleys, measured from a frozen snapshot of the code, with long runs in the background and the time-use tool read beside the counts; ends in a numbers table and, if the limit is missed, a decision card. Use for any "is this number right" question, a phase's balance milestone (two years, three winters, ten years), or after a change to rates in content. Not for map statistics (map-check) or for designing a new system.
---

# Balance check

A balance pass answers one question with numbers from real runs, then stops. Vulcan's north star is divergent, story-rich runs: a colony that fails is fine if the ledger explains why (VR-34). So the limits ask "does it happen, for a readable reason, and differently per valley", not "does everyone survive".

## 1. Write the question and its limit

One line each, before any run. For example: "Does a stranger arrive by year 2?" and "on at least 3 of 4 valleys, each arrival citing its cause". The phase spec's balance milestone gives the limit; if it doesn't, write one and say so.

## 2. Pick valleys, not plain seeds

- Use **picker valleys** (`seed/N`): `anvil/1`, `smoke/2`, `tallow/1`, `ledger/1` unless the spec names others. A plain seed (`anvil`) has no region, so no neighbours, no strangers and no lord: anything regional never fires (LESSONS 2026-10-25; runs-same review 2026-11-23: plain-seed runs never saw the reeve).
- Four valleys for a phase's balance milestone, three for a quick question. Never one.
- Default levers unless the question is about a lever.

## 3. Freeze the code before measuring

A run reads `src/` for its whole length; editing while it runs gives a run of two codebases, or a crash half way (LESSONS 2026-10-26). Measure from a snapshot worktree and keep editing the main one:

```sh
git worktree add --detach .claude/worktrees/bal-1 HEAD
ln -s "$PWD/node_modules" .claude/worktrees/bal-1/node_modules
cp -r src .claude/worktrees/bal-1/  # only to measure uncommitted changes
```

Name each snapshot by run (`bal-1`, `bal-2`), note its commit in the table, and remove it with `git worktree remove` when the pass ends.

## 4. Run long jobs in the background

- Read each tool's header comment for its arguments. `npm run decade` and `timeuse` take `<valley> <years> [out.json]`, one valley a process; pass the output path yourself (`tmp/decade-anvil-1.json`), since the default puts the `/` of `anvil/1` into the file name. `discover` takes `<valley> <years>` and prints its table. `families`, `callings` and `stages` take valleys then `-- <years>`; `annals` and `balance` take valleys (`annals --years N`).
- Timings measured on the 250-tile valley with four in parallel on 4 cores: `decade` 17 to 44 min for ten years, `timeuse` 30 to 83 min for ten years (2026-11-22 and 11-23); one year of `timeuse` on `anvil/1` alone took 90 s (2026-11-25).
- One valley per process, all four started at once with Bash `run_in_background`, from the snapshot worktree. You are told when each ends: don't poll or sleep. Do other work meanwhile.
- A run over about a minute may go to the `balance-runner` agent instead, with the exact commands and the columns wanted.

## 5. Read time use beside the counts

Counts say what happened; time use says whether colonists had anything to do. Run `npm run timeuse` on the same valleys and years, then summarise every file in one table:

```sh
node .claude/skills/balance-check/scripts/timeuse-summary.mjs tmp/timeuse-*.json
```

It prints, per valley and year: the living, adults idle in their own work hours, the top reason for that idleness, waking time spent walking, and runs of six hours or more stuck on one tile. Baseline on main before the fix threads (2026-11-23, ten years, plain seeds): idle in work hours 19 to 52%, walking 50 to 67% of waking time. A change that raises either is a finding, even if the counts look fine.

## 6. Tune content, three runs at most

- Between runs change content values only (`src/content`), never engine code. An engine bug found on the way is reported, not fixed here.
- Stop after three runs or 15 minutes of tuning, whichever comes first. Anything added on day 1 moves the whole seeded run, so prefer dials that act later (LESSONS 2026-10-26).
- Before keeping a tuning, run the slow tier (`npm run check:full`): a change to day-one stock has broken tests that leaned on a seed's first week.

## 7. Check the valleys differ

For a phase's balance milestone, also compare the valleys: the order in which line kinds first fire (from each `decade` JSON's `byYear[].counts`) and the story moments by year (weddings, callings, deaths, factions, the lord's visits). If two valleys tell the same story in the same order, say so with the numbers: it is a finding even when every limit passes (runs-same review q8; that review measured first-time order matching 0.78 to 0.90 between valleys).

## 8. Report

- One table: run, commit, values changed, then each limit per valley as a number, plus the time-use columns. Label anything estimated (REP-01).
- Under it: every valley outside a limit with its value and the ledger lines that explain it.
- If a limit is missed after three runs, post a decision card with the best two settings and their numbers (time-boxed tuning, AGENTS.md). Routine tuning cards go with the recommended option.
- Publish the table as an Artifact page when Morgan will read it (VR-41), and keep the JSONs under `/mnt/project-files/vulcan/<milestone>/` if a later review will compare against them.
