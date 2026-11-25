// One table from `npm run timeuse` output files (tools/timeuse.mjs), for the balance-check skill:
// per valley and year, the living, adults idle inside their own work hours, the top reason for that
// idleness, waking time spent walking, and runs of six hours or more stuck awake on one tile.
// Node built-ins only. Usage: node .claude/skills/balance-check/scripts/timeuse-summary.mjs tmp/timeuse-*.json
import { readFileSync } from 'node:fs';

// Activities that are not waking time (tools/timeuse.mjs RESTING).
const RESTING = new Set(['sleep', 'hurt', 'stocks', 'held']);

const sum = (o) => Object.values(o ?? {}).reduce((n, v) => n + v, 0);
const pct = (part, whole) => (whole ? `${Math.round((100 * part) / whole)}%` : '-');
const awake = (o) => Object.entries(o ?? {}).reduce((n, [k, v]) => (RESTING.has(k) ? n : n + v), 0);

/** One row per year of one timeuse file. */
function rows(run) {
  const out = [];
  for (const { year, alive, adults } of run.alive ?? []) {
    const inHours = run.hours?.[`${year}:adult`] ?? {};
    const reasons = {};
    let woke = 0;
    let walked = 0;
    for (const [key, acts] of Object.entries(run.bySeason ?? {})) {
      const [y, season] = key.split(':');
      if (Number(y) !== year) continue;
      woke += awake(acts);
      walked += awake(run.walk?.[key]);
      for (const [why, n] of Object.entries(run.why?.[`${y}:${season}`] ?? {}))
        reasons[why] = (reasons[why] ?? 0) + n;
    }
    const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    out.push({
      seed: run.seed,
      year,
      alive,
      adults,
      idle: pct(inHours.idle ?? 0, sum(inHours)),
      why: top ? `${top[0]} ${pct(top[1], sum(reasons))}` : '-',
      walking: pct(walked, woke),
      stuck: (run.stuck ?? []).filter((s) => s.year === year).length,
    });
  }
  return out;
}

const COLUMNS = ['seed', 'year', 'alive', 'adults', 'idle', 'why', 'walking', 'stuck'];
const HEAD = {
  ...Object.fromEntries(COLUMNS.map((c) => [c, c])),
  idle: 'idle in work hours',
  why: 'top idle reason',
  walking: 'walking (awake)',
  stuck: 'stuck 6h+',
};

const files = process.argv.slice(2);
if (!files.length) {
  process.stderr.write('usage: timeuse-summary.mjs <timeuse.json>...\n');
  process.exit(1);
}
const table = files.flatMap((f) => rows(JSON.parse(readFileSync(f, 'utf8'))));
const line = (r) => `| ${COLUMNS.map((c) => r[c]).join(' | ')} |`;
process.stdout.write(
  [line(HEAD), `|${COLUMNS.map(() => ' --- |').join('')}`, ...table.map(line)].join('\n') + '\n',
);
