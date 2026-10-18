# Toolkit

What a Vulcan thread can use, when to use it and what it costs. The project's own agents are in `.claude/agents/` and its skills in `.claude/skills/`; the synced ones are listed in `.ai-master.lock`. Checked 2026-10-17. A thread reads only the section it needs.

## 1. Handoff cost: when an agent is worth it

A cold agent spends 20 to 60k tokens reading in before it does anything (measured in AI-Master, DEL-02). Haiku costs about 1/40 of Opus per token and Sonnet about 1/5 (estimates from AI-Master's notes; check current pricing before relying on them). So:

| Hand off when | Keep in the main session when |
| --- | --- |
| The work would put over about 30k tokens of reading or output into the main session (a multi-seed run, a large diff review, a broad search) | It's a check that runs in under a minute (`npm run check`, browser smoke): run it directly |
| It's spec'd code over about 150 lines, or the same edit across many files | It's a fix under about 30 lines, or one file |
| Two or more independent pieces can run in parallel (each in its own worktree) | It needs a design decision, a question for Morgan, or the full conversation |

Every brief carries the goal, the reading list, the rules that apply, the done-when, the commands, "do not commit" and a report cap (DEL-04). Each handoff is logged in the thread-times line: agent, tokens and minutes the Agent tool reported, and whether its diff needed rework. An agent that needs rework twice in a phase, or costs more than doing the work directly, is changed or dropped at the phase review (DEL-07).

A deterministic chore is a script, not an agent or skill: code map, reading cost, file-size cap, sheet packing, content validation.

## 2. Agents

| Agent | Model | Source | Use for |
| --- | --- | --- | --- |
| `implementer` | Sonnet | synced from AI-Master | Spec'd coding: a module, its tests and wiring |
| `test-runner` | Haiku | synced | Long or noisy check runs only |
| `reviewer` | Sonnet | synced | Milestone diffs over about 500 lines; half of the phase review |
| `ci-fixer` | Sonnet | synced | Red CI on a PR |
| `balance-runner` | Haiku | new, Vulcan | Multi-seed balance, sweep and drama runs; reports one table |
| `mockup-maker` | Sonnet | new, Vulcan | HTML mock-ups of screens for UI milestones |
| `art-maker` | Sonnet | new, Vulcan | Scripted placeholder pixel art, packed sheets, provenance lines |
| `design-reviewer` | Sonnet | new, Vulcan | Review lens for VR-28 to VR-39: indirect control, causes, determinism, content over code |
| Explore | Haiku | built in | Broad searches with over about 10 KB of raw output |

The four new agents are on trial: each is measured on first use against doing the work directly, and the result goes in its thread-times line.

## 3. Skills

| Skill | Source | Use when |
| --- | --- | --- |
| `mockup-round` | new, Vulcan | Start of every milestone, after its spec is approved |
| `phase-review` | new, Vulcan | The last milestone of a phase has merged |
| `balance-check` | new, Vulcan | Any tuning question; the 15-minute, three-run box |
| `map-check` | new, Vulcan (adapted from Story Generator's `worldgen-check`) | After Phase 1 milestones or any map change |
| `art-sheet` | new, Vulcan | A milestone's art row comes due |
| `efficient-github-actions` | synced from AI-Master | Any change under `.github/workflows` or CI cost question |
| `bootstrap-project` | built in | Once, in P0.1, to adopt AI-Master |
| `session-start-hook` | built in | Once, in P0.1, for the cloud session hook |
| `artifact-design` | built in | Every page published for Morgan |
| `dataviz` | built in | Numbers tables and charts in engine mock-ups and balance reports |
| `run` | built in | Launching the game to screenshot or play a playtest |
| `code-review`, `simplify` | built in | Milestone self-review before asking for review |
| `harvest-lessons` | built in | Monthly, to push general lessons back to AI-Master |

AI-Master layers synced: `core`, `stacks/node-web`, `project-types/game`. The `simulator` layer is not adopted: its golden-file rule (SIM-02) clashes with computing expected values at test time (VR-24), and SIM-05 is about industrial safety.

## 4. Connectors

| Connector | Use | Note |
| --- | --- | --- |
| GitHub | PRs, CI status, reviews, branch cleanup | Always on |
| Vercel | Check the live deploy matches the merge commit | Production from `main` only |
| OpenArt | Optional placeholder art; the likely tool for the final art (V-034) | Paid credits: ask Morgan with an estimate first (SAFE-04) |
| tldraw, Figma | Optional diagrams or layout sketches | HTML mock-up artifacts are the default because they read on a phone |
| Mobbin | Reference screens for panels and inspectors | Reference only; nothing copied |
| Supabase | Not used | Cloud saves dropped for save files (V-032) |
| Claude Docs, Google Drive, Canva | Not used | The plan stays as files plus one artifact page |
| Stripe | Not used | Its sign-in has expired; nothing needs it |

## 5. Tools in a thread container

Bash, git, Node and npm (pinned versions installed by the session hook), Python 3, pandoc, ripgrep, jq, Playwright with the container's Chromium (`PLAYWRIGHT_CHROMIUM_PATH`). The Artifact tool publishes pages for Morgan; `/mnt/project-files/vulcan/` is the shared folder for the plan, mock-up sources and the thread-times log.
