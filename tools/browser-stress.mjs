// `npm run test:stress` (toolbox review P4, 2026-11-25): runs the browser tests several times on a
// loaded machine to find checks that pass alone and fail beside other work, then prints one line
// per test that failed at least once. Not part of `npm run check` or CI: run it after touching a
// browser test, the page's timers or saving, and before calling a flaky check fixed.
// The load is busy loops, `--load` of them (default 1), standing in for the ten-year run beside
// which the reload check failed in a thread container (2026-11-23). `--load 2` on a 4-core machine
// is harsher than CI: there the picker's world also misses its 20 s wait now and then. No retries.
// `npm run test:stress -- [--repeat 5] [--load 1] [spec files...]`; the long-jump lane (`alone`)
// runs after the rest, as in `npm run test:browser`.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  if (at < 0) return fallback;
  const [, value] = args.splice(at, 2);
  return Number(value);
};
const repeat = option('--repeat', 5);
const load = option('--load', 1);
const specs = args;

const hog = 'for(;;){}';
const hogs = Array.from({ length: load }, () =>
  spawn(process.execPath, ['-e', hog], { stdio: 'ignore' }),
);
const stopHogs = () => hogs.forEach((h) => h.kill());
process.on('exit', stopHogs);
process.on('SIGINT', () => process.exit(130));

const dir = mkdtempSync(join(tmpdir(), 'stress-'));
/** One Playwright run of one lane, without the lanes it depends on; returns its JSON report. */
function lane(project) {
  const out = join(dir, `${project}.json`);
  const cli = ['playwright', 'test', `--project=${project}`, `--repeat-each=${repeat}`];
  cli.push('--retries=0', '--reporter=list,json', '--pass-with-no-tests');
  // Each lane its own output folder, so the second run keeps the first one's traces.
  cli.push(`--output=test-results/stress-${project}`, '--no-deps', ...specs);
  console.log(`\n# ${project}: npx ${cli.join(' ')} (load ${load})`);
  spawnSync('npx', cli, {
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out },
  });
  try {
    return JSON.parse(readFileSync(out, 'utf8'));
  } catch {
    return { suites: [], errors: [{ message: `${project}: no report written` }] };
  }
}

/** Every test's results in a report: title, location, and its outcomes across the repeats. */
function tally(report, into) {
  const walk = (suite) => {
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests) {
        const key = `${spec.file}:${spec.line} ${spec.title}`;
        const row = into.get(key) ?? { passed: 0, failed: 0, errors: [] };
        for (const r of t.results) {
          if (r.status === 'passed') row.passed++;
          else if (r.status !== 'skipped') {
            row.failed++;
            const first = r.error?.message?.split('\n').find((l) => l.trim()) ?? r.status;
            row.errors.push(first.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 160));
          }
        }
        into.set(key, row);
      }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return report.errors ?? [];
}

const rows = new Map();
const started = Date.now();
const problems = [...tally(lane('chromium'), rows), ...tally(lane('alone'), rows)];
stopHogs();

const minutes = ((Date.now() - started) / 60_000).toFixed(1);
const total = [...rows.values()].reduce((n, r) => n + r.passed + r.failed, 0);
const flaky = [...rows].filter(([, r]) => r.failed > 0);
console.log(
  `\n# Stress: ${rows.size} tests x ${repeat}, load ${load}, ${total} runs, ${minutes} min`,
);
for (const p of problems) console.log(`ERROR ${p.message?.split('\n')[0]}`);
if (!flaky.length && !problems.length) console.log('No test failed.');
for (const [key, r] of flaky) {
  console.log(`FAIL ${r.failed} of ${r.passed + r.failed}: ${key}`);
  for (const e of new Set(r.errors)) console.log(`  ${e}`);
}
process.exitCode = flaky.length || problems.length ? 1 : 0;
