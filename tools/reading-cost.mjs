// Sums the size of each milestone's reading list in the phase specs and fails over budget
// (PLAN.md §6). A list is a line starting "Reading list:" with backticked repo paths; an
// #anchor counts the whole file. DECISIONS.md followed by row ids (V-129) counts only those rows,
// since sessions grep rows and never read it whole. Every list also pays for the files all
// sessions read first.
// Fails on a milestone with no list, a missing doc, or a list over budget.
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

const DECISIONS = 'docs/DECISIONS.md';

/** One `;`-separated part of a list: its files' sizes, or only the named DECISIONS rows. */
function partBytes(part) {
  const files = [...part.matchAll(/`([^`]+)`/g)].map((m) => m[1].split('#')[0]);
  const ids = [...part.matchAll(/\bV-\d+\b/g)].map((m) => m[0]);
  return files.reduce((sum, f) => {
    if (f !== DECISIONS || !ids.length) return sum + (size(path.join(root, f)) ?? 0);
    const rows = readFileSync(path.join(root, f), 'utf8')
      .split('\n')
      .filter((row) => ids.some((id) => row.startsWith(`| ${id} |`)));
    return sum + rows.reduce((n, row) => n + Buffer.byteLength(row) + 1, 0);
  }, 0);
}

export function readingCosts(specs) {
  const baseBytes = base.reduce((sum, f) => sum + (size(path.join(root, f)) ?? 0), 0);
  const rows = [];
  const unlisted = [];
  for (const spec of specs) {
    let milestone = '';
    for (const line of readFileSync(spec, 'utf8').split('\n')) {
      const heading = line.match(/^#{2,4}\s+(P\d+\.\d+)/);
      if (heading) {
        if (milestone && !rows.some((r) => r.milestone === milestone)) unlisted.push(milestone);
        milestone = heading[1];
      }
      if (!/^\s*[-*]?\s*Reading list:/i.test(line)) continue;
      const files = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1].split('#')[0]);
      const missing = files.filter((f) => size(path.join(root, f)) === null);
      const bytes = line.split(';').reduce((sum, part) => sum + partBytes(part), baseBytes);
      rows.push({ spec: rel(spec), milestone, bytes, missing });
    }
    if (milestone && !rows.some((r) => r.milestone === milestone)) unlisted.push(milestone);
    milestone = '';
  }
  return { rows, unlisted };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const specs = args.length
    ? args.map((a) => path.resolve(a))
    : walk(path.join(root, 'docs/phases'), (f) => f.endsWith('.md'));
  const { rows, unlisted } = readingCosts(specs);
  let over = 0;
  const errors = unlisted.map((m) => `${m} has no "Reading list:" line.`);
  for (const r of rows) {
    const kb = (r.bytes / 1024).toFixed(1);
    const flag = r.bytes > budgetBytes ? ' OVER' : '';
    if (flag) over++;
    // Code a later milestone will write may be listed ahead; a missing doc is a typo.
    for (const f of r.missing.filter((f) => !f.startsWith('src/')))
      errors.push(`${r.milestone}: ${f} does not exist.`);
    const note = r.missing.length ? ` (not yet written: ${r.missing.join(', ')})` : '';
    process.stdout.write(`${r.milestone || r.spec}: ${kb} KB${flag}${note}\n`);
  }
  if (over) errors.push(`${over} reading list(s) over ${budgetBytes / 1024} KB; trim them.`);
  if (!rows.length) errors.push('No reading lists found in the phase specs.');
  if (errors.length) {
    process.stderr.write(errors.join('\n') + '\n');
    process.exitCode = 1;
  }
}
