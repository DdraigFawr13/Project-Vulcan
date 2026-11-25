---
name: mockup-round
description: Run a milestone's or slice's mock-up round in a Vulcan design thread - a screen mock-up or an engine output mock-up, checked, reviewed by a fresh agent and sent to Morgan as a saved Artifact form - then stop, because a fresh thread builds it (VR-74). Use at the start of every milestone or slice once its spec is approved, and whenever a brief says "mock-up thread" or "design thread". Not for screenshots of finished work (VER-06) or for building anything.
---

# Mock-up round

A design thread shows Morgan what a slice will do before any of it is built, and asks the questions only Morgan can answer. It ends when the form is posted. The synced `ui-mockups` skill holds the general method (fact checks, the check record, the fresh check, `mockup-lint`); this skill is the Vulcan wrapper around it. Where the two differ, this one wins in this repo.

## 0. Know what kind of thread this is

- This is a **design thread**: no code under `src/`, `tests/`, `tools/` or `art/`, no PR that changes the game, and no other thread started (VR-74, WS-02). A spec or doc PR is fine only if the brief asks for one.
- Log the setup time line when you start (VR-46).
- Read only: the brief, the phase spec's slice section and its reading list, `docs/UI_STYLE.md` for a screen, and the DECISIONS rows the slice names (grep `^| V-NNN`, never the whole file).

## 1. Pick the kind from the spec

The phase spec names it per slice ("Mock-up: UI" or "Mock-up: engine").

- **Screen kind**: a sheet, button, alert or layout change. Drawn at 390 px first (VR-57), then desktop if the layout changes there.
- **Engine kind**: a system whose output Morgan judges (a ledger, a number that moves, what colonists do).

Either way the page has the same shape (VR-60): plain text, two or three pictures, one three-valley table, and the questions. No jargon: no type ids, no function names, no rule ids in what Morgan reads; say "the Work sheet", not `workSheet`.

## 2. Test it against indirect control first

Before drawing anything, check every lever on the page against V-041 and VR-28: a lever sets a colony-wide level, a law, a standing order, what to build, or a person's standing priorities. Nothing on the page moves, drafts or targets one colonist, or marks a tile to work. If the spec seems to need one, that is a question for Morgan, not a button (LESSONS 2026-10-18: a mock-up drew stockpile zones and passed review).

## 3. Get the numbers from real valleys

- Use three **picker valleys** (`anvil/1`, `smoke/2`, `tallow/1` or as the brief says). Plain seeds (`anvil`) have no region, no neighbours and no lord, so anything regional never shows on them (LESSONS 2026-10-25; runs-same review 2026-11-23).
- If the code exists on `main` or a built slice's branch, run it with the tools in `package.json` (`npm run decade`, `timeuse`, `discover`, `families`, `callings`, `stages`, `annals`); each one's header comment gives its arguments, and the `balance-check` skill step 4 lists them. Runs of a year or more go in the background, one valley per process, measured from a snapshot worktree (see the `balance-check` skill, steps 3 and 4).
- If the code doesn't exist yet, label every number "estimate" and say what it is estimated from. Never invent a mechanic or a number to fill a cell (WS-06).
- Sample lines (three ledger lines, three inspector or "why?" lines) are written in the game's voice from real names in the run, with causes that the engine would actually cite.

## 4. Draw it (screen kind)

- Brief the `mockup-maker` agent, or draw it yourself when it is one small sheet. Brief: the spec section, `docs/UI_STYLE.md`, the art sheets in `public/art/`, the states to show (normal, empty, alert, paused), 390 px, and the output path under `tmp/mockups/`.
- Follow UI_STYLE's "What a new screen must do": tokens only, pressing on oak and iron, reading on paper, 44 px taps (V-077), text 11 px or more, sheet at most 40% of the screen, ✕ pinned, levers that work while paused.
- Word buttons, alerts, empty sheets and "why?" lines with `design:ux-copy` (VR-64). Check contrast, tap size and colour-not-only by hand or script at 390 px (VR-65).
- Screenshot it at 390 px with Playwright (`deviceScaleFactor: 2` for what Morgan sees) and look at it before anyone else does (VER-06).

## 5. Review it with a fresh agent

Start one fresh `general-purpose` or `reviewer` agent that never saw this thread. Give it the page, the spec section, UI_STYLE (screens) and the DECISIONS rows, but not your opinion. Ask it for: anything that breaks indirect control, numbers or names not in the files, a mechanic the spec doesn't have, text under 11 px or taps under 44 px, and anything Morgan would find confusing. Cap the report at 40 lines. Fix what holds up (VER-05) and say in the thread how many findings you took.

If the brief asks for the coordinator's spot check instead (VR-59), reply only "ready for review pass", with no link or attachment (LESSONS 2026-10-18), and wait.

## 6. Build the form from the shared template

- Copy `.claude/skills/planning-interview/assets/form.html` to the scratchpad and fill `%%TITLE%%` and `%%CONFIG%%` as that skill's "Building a form" says. Do not hand-copy form code from an older page.
- The mock-up itself goes in `info` items (pictures as `<img>` data URIs or uploaded assets, the table, the sample lines). Each decision is a `single` question with two to four options in Morgan's words, one marked `rec: 1` with its reason in `why`, and a notes box. End with a free-text "anything else".
- Ask only what changes what gets built. Small forks get a default you state on the page (VR-14).
- Open the filled page once in Playwright at 390 px: every question shows its options, no console errors, no sideways scroll. Then publish with `capabilities: {"db": {}, "user": {}}` and an `icon`, and make one `ArtifactData` `list` call to confirm it answers.

## 7. Hand it over and stop

1. Copy the page source and its pictures to `/mnt/project-files/vulcan/<milestone>/`.
2. Save the form's link and its collection name where the next thread will find it: project memory in cloud threads, and the phase spec's Status line if the brief allows a doc edit.
3. Post Morgan the link with one line on what it asks.
4. Log the thread-times line: start, form published, runs made, review findings taken.
5. **Stop.** Do not build, do not start the build thread. When Morgan answers, the coordinator starts a fresh build thread with the answers, which also approve the merge once CI is green (VR-74).
