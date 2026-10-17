---
name: mockup-round
description: Run a milestone's mock-up round before any build code - a UI screen mock-up or an engine output mock-up - and publish it as a phone-readable artifact for Morgan's approval. Use at the start of every milestone after its spec is approved.
---

# Mock-up round

1. Read the milestone row in the phase spec: its Mock-up kind (UI or Engine) and its "done when".
2. **UI**: brief the `mockup-maker` agent with the spec section, states to show (normal, empty, alert), art sheets and an output path under `tmp/mockups/`. **Engine**: write the output mock-up yourself: a numbers table across the seed list (or a labelled estimate when the code doesn't exist yet), three sample inspector lines and three sample ledger lines.
3. Review it once: every number labelled measured or estimated, no invented mechanic, readable at 400 px, both themes.
4. Publish it as an artifact, copy the source to `vulcan/<milestone>/` in the project files, and post one decision card: approve, change, or rethink. UI mock-ups get the coordinator review pass first.
5. Approval of the mock-up is also approval to merge once CI is green. Log the setup time line before building.
