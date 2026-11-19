// `npm run coverage` (refactor plan proposal 2) ends here: one line per system from Vitest's
// `coverage/coverage-summary.json`, lowest line coverage first, so a phase review sees which
// systems have little or no test. Report only; no floor yet (set one from these numbers).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, rel, root } from './lib.mjs';

/** Folds per-file totals into one row per system: src/<layer>/<system>, or the layer itself. */
export function bySystem(summary) {
  const rows = new Map();
  for (const [file, totals] of Object.entries(summary)) {
    if (file === 'total') continue;
    const parts = rel(path.resolve(root, file)).split('/');
    const key = parts.length > 3 ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
    const row = rows.get(key) ?? { key, covered: 0, total: 0, files: 0 };
    row.covered += totals.lines.covered;
    row.total += totals.lines.total;
    row.files += 1;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, pct: r.total ? (100 * r.covered) / r.total : 100 }))
    .sort((a, b) => a.pct - b.pct || a.key.localeCompare(b.key));
}

if (isMain(import.meta.url)) {
  const summary = JSON.parse(
    readFileSync(path.join(root, 'coverage/coverage-summary.json'), 'utf8'),
  );
  const out = ['Line coverage by system (lowest first):'];
  for (const r of bySystem(summary))
    out.push(`- ${r.key}: ${r.pct.toFixed(1)}% of ${r.total} lines, ${r.files} files`);
  out.push(`Total: ${summary.total.lines.pct}% of ${summary.total.lines.total} lines.`);
  process.stdout.write(out.join('\n') + '\n');
}
