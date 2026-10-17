---
name: balance-check
description: Time-boxed balance or tuning pass over the seed list - at most 15 minutes or three runs per question, then a numbers table and a decision card. Use for any "is this number right" question, the Phase 4 one-year pass, or after a change to rates in content.
---

# Balance check

1. Write the question in one line and the limit that answers it (for example "five alive in spring on at least 8 of 10 seeds").
2. Send the run to `balance-runner` when it takes over a minute; run it directly when shorter. Use the seed list from the test helpers, never a single seed.
3. Change content values only, never engine code, between runs. Stop after three runs or 15 minutes, whichever comes first.
4. Report a table: run, values changed, result per limit. If the limit is not met, post a decision card with the best two settings and their numbers.
