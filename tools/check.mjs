// `npm run check`: every local check in order, with step timings against its budget (RULES.md
// VR-67). Stops at the first failure; warns, never fails, on time alone. The quick check leaves
// out the slow and the long test files listed in vitest.config.ts; `npm run check:full` (`--full`)
// leaves out only the long ones, run once before a PR is marked ready; `npm run check:all`
// (`--all`) runs every file, and CI's core job runs it.
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { root } from './lib.mjs';
import { writeStamp } from './ready-gate.mjs';

const all = process.argv.includes('--all');
const full = all || process.argv.includes('--full');
const tier = all ? 'all' : full ? 'full' : 'quick';
// The every-file tier is CI's, on its two-core runner: its budget is CI's 5 minutes (VR-25).
const budgetSeconds = { quick: 40, full: 120, all: 300 }[tier];
const steps = [
  ['ai-master', 'node .claude/master/sync.mjs --check'],
  ['format', 'npx prettier --check --cache .'],
  ['typecheck', 'npx tsc --noEmit'],
  ['boundaries', 'node tools/check-boundaries.mjs'],
  ['limits', 'node tools/check-limits.mjs'],
  ['shape', 'node tools/check-shape.mjs'],
  ['codemap', 'node tools/codemap.mjs --check'],
  ['reading', 'node tools/reading-cost.mjs'],
  ['unit', `VULCAN_TESTS=${tier} npx vitest run`],
  ['build', 'npx vite build --logLevel warn'],
];

const times = [];
const start = Date.now();
for (const [name, command] of steps) {
  const t = Date.now();
  const run = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' });
  times.push(`${name} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  if (run.status !== 0) {
    process.stderr.write(`\ncheck FAIL at ${name}\n`);
    process.exit(run.status ?? 1);
  }
}
const total = (Date.now() - start) / 1000;
const line = `${full ? `${tier} ` : ''}check passed in ${total.toFixed(1)}s: ${times.join(', ')}`;
process.stdout.write(`\n${line}\n`);
// The ready gate (tools/ready-gate.mjs) lets a PR be marked ready only after this on its commit.
if (all && !process.env.CI) process.stdout.write(`${writeStamp()}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
if (total > budgetSeconds)
  process.stdout.write(
    `warn: over the ${budgetSeconds}s budget; log it as OVER (RULES.md VR-47).\n`,
  );
