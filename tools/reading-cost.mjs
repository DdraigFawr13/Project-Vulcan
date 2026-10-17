// Sums the size of each milestone's reading list in the phase specs and fails over budget
// (PLAN.md §6). A list is a line starting "Reading list:" with backticked repo paths; an
// #anchor counts the whole file. Every list also pays for the files all sessions read first.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, rel, root, size, walk } from './lib.mjs';

export const budgetBytes = 80 * 1024; // about 20k tokens at an estimated 4 bytes a token
export const base = [
  'AGENTS.md',
  '.claude/master/RULES.md',
  'docs/AGENT_BRIEF.md',
  'docs/CODEMAP.md',
];

export function readingCosts(specs) {
  const baseBytes = base.reduce((sum, f) => sum + (size(path.join(root, f)) ?? 0), 0);
  const rows = [];
  for (const spec of specs) {
    let milestone = '';
    for (const line of readFileSync(spec, 'utf8').split('\n')) {
      const heading = line.match(/^#{2,4}\s+(P\d+\.\d+)/);
      if (heading) milestone = heading[1];
      if (!/^\s*[-*]?\s*Reading list:/i.test(line)) continue;
      const files = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1].split('#')[0]);
      const missing = files.filter((f) => size(path.join(root, f)) === null);
      const bytes = files.reduce((sum, f) => sum + (size(path.join(root, f)) ?? 0), baseBytes);
      rows.push({ spec: rel(spec), milestone, bytes, missing });
    }
  }
  return rows;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const specs = args.length
    ? args.map((a) => path.resolve(a))
    : walk(path.join(root, 'docs/phases'), (f) => f.endsWith('.md'));
  const rows = readingCosts(specs);
  let over = 0;
  for (const r of rows) {
    const kb = (r.bytes / 1024).toFixed(1);
    const flag = r.bytes > budgetBytes ? ' OVER' : '';
    if (flag) over++;
    const note = r.missing.length ? ` (not yet written: ${r.missing.join(', ')})` : '';
    process.stdout.write(`${r.milestone || r.spec}: ${kb} KB${flag}${note}\n`);
  }
  if (over) {
    process.stderr.write(`${over} reading list(s) over ${budgetBytes / 1024} KB; trim them.\n`);
    process.exitCode = 1;
  }
}
