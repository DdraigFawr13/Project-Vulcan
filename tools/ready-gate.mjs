// PreToolUse hook (VR-67, toolbox review P1): refuses to mark a Project-Vulcan PR ready for review
// unless `npm run check:all` passed on the commit checked out now, with nothing uncommitted.
// tools/check.mjs writes the stamp (`stampFile()`) when the every-file tier passes on a clean tree.
// Fails open: an error lets the call through with a one-line note.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL = 'mcp__github__update_pull_request';
const repoRoot = fileURLToPath(new URL('../', import.meta.url));

const git = (args, cwd = repoRoot) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** The stamp's path: inside this worktree's own git dir, so it is never committed. */
export function stampFile(cwd = repoRoot) {
  return path.resolve(cwd, git(['rev-parse', '--git-dir'], cwd), 'vulcan-check-all.json');
}

/** HEAD and whether tracked files have uncommitted changes. */
export function treeState(cwd = repoRoot) {
  const head = git(['rev-parse', 'HEAD'], cwd);
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], cwd) !== '';
  return { head, dirty };
}

/** Called by tools/check.mjs after the every-file tier passes. Returns the note to print. */
export function writeStamp(cwd = repoRoot) {
  const { head, dirty } = treeState(cwd);
  if (dirty)
    return 'note: uncommitted changes, so no ready stamp was written; commit, then run check:all again';
  writeFileSync(stampFile(cwd), JSON.stringify({ head, ts: new Date().toISOString() }) + '\n');
  return `ready stamp written for ${head.slice(0, 12)}`;
}

/**
 * The deny reason for a tool call, or null to let it through.
 * `stamp` is the parsed stamp or null; `head` and `dirty` describe the tree now.
 */
export function decide(input, { stamp, head, dirty }) {
  if (input?.tool_name !== TOOL) return null;
  const args = input.tool_input ?? {};
  if (args.draft !== false || String(args.repo ?? '').toLowerCase() !== 'project-vulcan')
    return null;
  const fix =
    'Run `npm run check:all` (give it to the test-runner) on the final commit, commit nothing after it, then mark ready (VR-67)';
  if (dirty) return `uncommitted changes in the working tree. Commit them first. ${fix}`;
  if (!stamp?.head) return `no \`npm run check:all\` pass is recorded in this worktree. ${fix}`;
  if (stamp.head !== head)
    return `the last \`npm run check:all\` pass was on ${stamp.head.slice(0, 12)}, but HEAD is ${head.slice(0, 12)}. ${fix}`;
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
    if (input?.tool_name !== TOOL || input.tool_input?.draft !== false) return;
    let stamp = null;
    try {
      stamp = JSON.parse(readFileSync(stampFile(), 'utf8'));
    } catch {
      // No stamp yet: decide() says so.
    }
    const reason = decide(input, { stamp, ...treeState() });
    if (!reason) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `vulcan ready-gate (deny): ${reason}`,
        },
      }),
    );
  } catch (err) {
    const line = String(err?.message ?? err).split('\n')[0];
    process.stdout.write(
      JSON.stringify({ systemMessage: `vulcan ready-gate error: ${line}; check skipped` }),
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
