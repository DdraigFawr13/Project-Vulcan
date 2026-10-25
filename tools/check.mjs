// `npm run check`: every local check in order, with step timings against its budget (RULES.md
// VR-67). Stops at the first failure; warns, never fails, on time alone. The quick check leaves
// out the slow colony-run test files listed in vitest.config.ts; `npm run check:full` (`--full`)
// runs every file, once before a PR is marked ready, and CI's core job runs it too.
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { root } from './lib.mjs';

const full = process.argv.includes('--full');
const budgetSeconds = full ? 120 : 40;
const steps = [
  ['ai-master', 'node .claude/master/sync.mjs --check'],
  ['format', 'npx prettier --check --cache .'],
  ['typecheck', 'npx tsc --noEmit'],
  ['boundaries', 'node tools/check-boundaries.mjs'],
  ['limits', 'node tools/check-limits.mjs'],
  ['codemap', 'node tools/codemap.mjs --check'],
  ['reading', 'node tools/reading-cost.mjs'],
  ['unit', full ? 'npx vitest run' : 'VULCAN_TESTS=quick npx vitest run'],
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
const line = `${full ? 'full ' : ''}check passed in ${total.toFixed(1)}s: ${times.join(', ')}`;
process.stdout.write(`\n${line}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
if (total > budgetSeconds)
  process.stdout.write(
    `warn: over the ${budgetSeconds}s budget; log it as OVER (RULES.md VR-47).\n`,
  );
