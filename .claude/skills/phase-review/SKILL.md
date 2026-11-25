---
name: phase-review
description: Review a finished Vulcan phase on main before it goes to Morgan - play its playtest on the production build at 390 px, review the phase's whole diff, check every done-when, run the time-use and sameness numbers on four picker valleys and compare them with the last phase, list overruns, fix everything in one PR, then hand the phase to Morgan with a page. Use when the last milestone or slice of a phase has merged. Not for reviewing one PR (reviewer) or for an audit of the whole repo (audit).
---

# Phase review

A phase goes to Morgan only after Claude has played it, read it and fixed it (VR-06, VR-07). Each review also measures the phase against the last one, so drift in what colonists do, and runs that all tell the same story, show up as numbers rather than as Morgan's complaint.

## 1. Set up

- Confirm every slice of the phase is merged: the phase spec's Status section is all ticked, and no PR or build thread for the phase is still open. Note anything unmerged in the report rather than waiting on it.
- Find the phase's first commit: `git log --reverse --oneline -- docs/phases/PHASE_N.md | head -1`.
- Read the spec's "Phase done (playtest)" section and every slice's "Done when" line.
- Make a folder for the numbers: `/mnt/project-files/vulcan/<phase>-review/`. Find the last phase's folder; its `numbers.md` is what this one is compared with.

## 2. Start the long runs first

They take 30 to 80 minutes for ten years, so start them before anything else and review while they run (the `balance-check` skill, steps 2 to 5, has the commands):

- Four picker valleys (`anvil/1`, `smoke/2`, `tallow/1`, `ledger/1`, or the same four as the last review), from a snapshot worktree of `main`, each in its own background process.
- `npm run decade` and `npm run timeuse` for the span the phase's balance milestone names (ten years if it names none).
- Any tool the phase added for its own done-when (for example `npm run discover` for 6C).

## 3. Play the playtest

- `npm run build`, then play the "Phase done" steps on the production build with the `run` skill and Playwright at 390 px, tapping as a player would, not through `?debug` (LESSONS 2026-10-18 and 2026-10-19: bugs hid behind desktop size, the keyboard and the URL flag).
- Screenshot each step at `deviceScaleFactor: 2`. Use Jump ahead to reach later years, and open every sheet the phase touched on the way: a view that reads an old ledger line once crashed the live game while every engine run passed (LESSONS 2026-10-26).
- Check every lever the phase added against indirect control (V-041, VR-28): nothing targets one colonist or marks a tile.

## 4. Review the whole diff

- `git diff <first>^..main --stat -- src` for size, then the diff itself.
- Over about 1,500 lines: run `shepherd:reviewer` (branch mode) and `design-reviewer` in parallel; `shepherd:reviewer` replaced `reviewer` here after the Phase 3 trial (TOOLKIT §3). Smaller: read it yourself with the `design-reviewer` lens (VR-28 to VR-39).
- Verify each finding before acting (VER-05, DEL-05): run the related test, check it against DECISIONS, and reject findings that contradict a settled row.

## 5. Check every done-when

For each slice, one line: the done-when, the command or screenshot that checks it, and pass or fail with its number. A ten-valley table, if the spec asks for one, is produced here and nowhere else (VR-60).

## 6. Measure against the last phase

When the long runs finish:

- **Time use**: `node .claude/skills/balance-check/scripts/timeuse-summary.mjs <files>` gives idle in work hours, the top idle reason, walking share and stuck runs per valley and year.
- **Sameness**: the order in which line kinds first fire and the story moments per valley year (`balance-check` step 7). Say which valleys diverged and which told the same story.
- **Counts**: the living each year, and the line kinds the phase added that never fired on any valley (a kind that never fires is a finding).
- Put all three beside the last phase's numbers. A rise in idle or walking, or valleys growing more alike, is a finding with the same weight as a bug. Write them to `<phase>-review/numbers.md` with the commit and valleys, so the next review can compare.

## 7. Overruns and lessons

- Read the phase's lines in `/mnt/project-files/vulcan/process/thread-times.md` and list every OVER and every budget miss (VR-46, VR-47), with its cause.
- Add or bump LESSONS lines for mistakes found (SRC-05); a count of 2 becomes a rule in `docs/RULES.md`.

## 8. Fix in one PR

- One branch from the latest `main`, one draft PR with every fix (VR-06). A regression test for each bug at the level where it lived (VR-26).
- `npm run check` on every push. Before ready: `npm run check:full` and `npm run test:browser` once (VR-67), plus `npm run check:all` when a fix touched a system with a long test file, since CI runs those and check:full does not. Keep `npm run shape` green; lower the baseline with `npm run shape -- --update` only after a refactor lowers a count.
- Tick the review in the phase spec, update CHANGELOG, then mark ready, which runs CI once (VR-54). Merge on green; batch the merge with others where you can, since each merge to `main` is a Vercel deploy.

## 9. Hand the phase to Morgan

After the fix PR is merged and live (check the deploy's commit is the merge commit, CI-05), send one message (VR-07) with one Artifact page that reads on a phone:

- what to try (the playtest steps in plain words) and the live link;
- the screenshots;
- the numbers against the last phase, in one small table, with what changed and why;
- what is known to be rough, and the overruns with what was changed.

Offer the `audit` skill (VER-09) and ask the playtest check-in. Morgan's findings come back as the next PR, and each correction goes in LESSONS.
