---
name: phase-review
description: Review a finished phase on main before it goes to Morgan - play its playtest on the production build, review the phase's whole diff, check every done-when, list setup-time overruns, then fix in one PR. Use when the last milestone of a phase has merged.
---

# Phase review

1. Read the phase spec's Status section and the phase file's "Phase done" line. Find the phase's first commit with `git log --oneline -- docs/phases/PHASE_N.md`.
2. Build production (`npm run build`) and play the playtest with the `run` skill; take screenshots of each step.
3. Review the phase diff (`git diff <first>^..main -- src`): send it to `reviewer` and `design-reviewer` in parallel when it is over 1,500 lines; read it yourself when smaller.
4. Check every milestone's "done when" against a command or screenshot. Read the phase's lines in `vulcan/process/thread-times.md` and list every OVER with its cause.
5. Fix everything found in one PR. After it merges, send Morgan one message: what to try, the live link, a screenshots artifact, known rough edges, and the overruns with what was changed.
