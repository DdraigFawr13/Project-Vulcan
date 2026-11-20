---
name: mockup-round
description: Run a milestone's mock-up round before any build code - a UI screen mock-up or an engine output mock-up - and publish it as a phone-readable Artifact form for Morgan, then stop: a fresh thread builds it (VR-74). Use in a design thread at the start of every milestone after its spec is approved.
---

# Mock-up round

1. Read the milestone row in the phase spec: its Mock-up kind (UI or Engine) and its "done when".
2. **UI**: brief the `mockup-maker` agent with the spec section, the phase's taste board (VR-56), phone width first (VR-57), states to show (normal, empty, alert), art sheets and an output path under `tmp/mockups/`. **Engine**: write the output mock-up yourself: a numbers table across the seed list (or a labelled estimate when the code doesn't exist yet), three sample inspector lines and three sample ledger lines.
3. Review it once: every number labelled measured or estimated, no invented mechanic, readable at 400 px, both themes. **UI**: word it with the `design:ux-copy` skill (VR-64) and pass the accessibility check (VR-65).
4. Publish it as an Artifact **form**, UI or engine: each question with options, the recommendation marked, and a notes box under it, saving the answers (WS-08). **UI**: first reply only "ready for review pass", wait for the coordinator's spot check (VR-59), apply it and republish to the same link. Then post the form's link to Morgan, copy the source to `vulcan/<milestone>/` in the project files and log the setup time line.
5. **Stop.** This thread does not build and does not start another thread (VR-74, WS-02). Morgan's answers are the approval of the mock-up and of the merge once CI is green; the coordinator starts a fresh build thread with them.
