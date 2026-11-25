// design.build (WS-02, D-079): a design session stops at its spec or mock-up form and never builds it.
// A session becomes a design session when it runs `node .claude/hooks/guards/design-session.mjs`
// (its brief says so), or when, before any build edit, it creates a spec, phase plan or mock-up file.
// From then on, edits to build paths (code and tests) are denied for the rest of the session.
// Synced from AI-Master-Instructions (hook/guards); edit it there.
import fs from 'node:fs';
import path from 'node:path';
import { matchesAny } from '../glob.mjs';
import { updateSession } from '../lib.mjs';
import { operands } from '../parse.mjs';
import { written } from './synced.mjs';

export const DECLARE = '.claude/hooks/guards/design-session.mjs';
/** A mock-up file or folder anywhere, inside the project or outside it (a shared project folder). */
const MOCKUP = /mock-?ups?/i;

/** Every path the call writes: { rel (null outside the root), abs }. */
function targets(input, facts) {
  if (input.tool_name !== 'Bash') {
    const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    if (typeof file !== 'string' || !file) return [];
    return [{ rel: facts.rel(file), abs: path.resolve(facts.cwd, file) }];
  }
  const out = [];
  for (const c of facts.commands()) {
    for (const arg of [...c.redirects, ...written(c)]) {
      if (typeof arg !== 'string' || /^[~$]/.test(arg)) continue;
      out.push({ rel: facts.rel(arg, c.dir), abs: path.resolve(c.dir, arg) });
    }
  }
  return out;
}

/** True when the Bash call runs the declaration script. */
function declares(input, facts) {
  if (input.tool_name !== 'Bash') return false;
  return facts.commands().some((c) => c.name === 'node' && operands(c.args).length > 0 && facts.rel(operands(c.args)[0], c.dir) === DECLARE);
}

/** A new file (not on disk yet) that marks a design session: a design path, or any path naming a mock-up. */
function designFile(input, facts, list) {
  if (input.tool_name !== 'Write') return null;
  return list.find((t) => !fs.existsSync(t.abs) && ((t.rel !== null && matchesAny(facts.design, t.rel)) || MOCKUP.test(t.abs))) ?? null;
}

const MESSAGE = (rel, why) =>
  `this is a design session (${why}), and a design session never builds (WS-02): \`${rel}\` is a build path. ` +
  'Post the spec or mock-up form for the owner and stop; a fresh session builds it. Do not work around this guard';

export const checks = [
  {
    id: 'design.build',
    rule: 'WS-02',
    tools: ['Edit', 'Write', 'NotebookEdit', 'Bash'],
    mode: 'deny',
    test(input, facts) {
      const state = facts.session;
      if (!state) return null;
      const now = Math.floor(Date.now() / 1000);
      if (declares(input, facts)) {
        if (!state.design) updateSession(facts, { design: { why: 'it ran design-session.mjs', ts: now } });
        return null;
      }
      const list = targets(input, facts);
      if (!list.length) return null;
      const build = list.find((t) => t.rel !== null && matchesAny(facts.build, t.rel));
      if (state.design) return build ? MESSAGE(build.rel, state.design.why) : null;
      if (build) {
        if (!state.built) updateSession(facts, { built: now });
        return null;
      }
      if (state.built) return null;
      const made = designFile(input, facts, list);
      if (made) updateSession(facts, { design: { why: `it created \`${made.rel ?? path.basename(made.abs)}\``, ts: now } });
      return null;
    },
  },
];
