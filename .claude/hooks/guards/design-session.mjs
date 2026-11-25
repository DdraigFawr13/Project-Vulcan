#!/usr/bin/env node
// Run this first in a design, spec or mock-up session: `node .claude/hooks/guards/design-session.mjs`.
// The PreToolUse guard (checks/design.mjs) sees the call and, for the rest of the session, denies
// edits to build paths (code and tests), so the session stops at its form (WS-02, D-079).
// Synced from AI-Master-Instructions (hook/guards); edit it there.
process.stdout.write(
  'Design session: edits to code and tests are now blocked for this session (WS-02). ' +
    'Write the spec or mock-up form, post it for the owner, and stop; a fresh session builds it.\n',
);
