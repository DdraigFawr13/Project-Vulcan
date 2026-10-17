# Lessons

Mistakes Morgan has corrected. One line per lesson: date · area · mistake · root cause · rule · count. When a mistake repeats, bump its count; at a count of 2 the rule also goes into RULES.md. Mark retired entries SUPERSEDED; never delete them.

- 2026-10-17 · process · built a milestone 1 scaffold (Project-Vulcan PR #1) before the plan was agreed · treated a go-ahead to start as approval to build, with no plan or phase spec in place · no code before Morgan approves the plan and the phase's spec (RULES.md VR-18) · 1
- 2026-10-17 · delivery · sent the plan, rules and lessons only as .md files, which Morgan can't read on a phone · assumed the project's file preview works everywhere · publish anything Morgan must read as an artifact page too (RULES.md VR-41) · 1
- 2026-10-17 · ci · PR #2 ran full CI on its first draft push and again on the fix push, before Morgan wanted it merged · CI triggered on every push to any PR, drafts included · CI runs only when a PR is marked ready; drafts are checked locally (RULES.md VR-54) · 1
- 2026-10-17 · review · the P0.3 engine mock-up went to Morgan with no coordinator review pass · the plan sent engine mock-ups straight to Morgan and only UI mock-ups through the coordinator · every mock-up gets the coordinator's pass and its fixes before the approval card; PRs keep self-review so CI runs once (RULES.md VR-55) · 1
- 2026-10-17 · process · P0.1's merge PR left its own milestone unticked in the PHASE_0 Status section · the spec was written in the same PR, so the merge step was missed · tick the milestone in the PR before marking it ready (AGENT_BRIEF step 5) · 1
- 2026-10-17 · ci · PR #5 sat 19 min after green CI until Morgan asked · the thread waited for a wake on the passing run that never came (only the draft-skip suite event arrived) · after marking a PR ready, check its runs again within CI's time budget instead of waiting for an event · 1
