// `npm run shape`: the refactor guard rails (refactor plan proposal 1, the `refactor` skill A2-A4).
// Counts long functions, tangled functions, helpers copied into several files and oversize module
// contracts, and fails only when a count rises above `tools/shape-baseline.json` (a ratchet), so
// old debt is paid down without new debt arriving. `--update` lowers the baseline after a refactor
// and refuses to raise it; raising a number means editing the JSON by hand, in review.
//
// Complexity counts decision points per function, plus one: if, ?:, each loop, each `case`, each
// catch, and each &&, || and ??. A nested function is counted on its own, not in its parent.
// Copied helpers come from the synced `hotspots.mjs` (one home for the rule): top-level helper
// names defined in two or more files with identical bodies. Tests and content data are skipped.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { analyse } from '../.claude/skills/refactor/scripts/hotspots.mjs';
import { dirs, isMain, rel, root, walk } from './lib.mjs';

export const thresholds = { longLines: 80, complexHigh: 25, complexMid: 15, moduleBytes: 6144 };
const baselineFile = path.join(root, 'tools/shape-baseline.json');

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
]);
const DECISION_TYPES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
]);

function decisions(node) {
  if (DECISION_TYPES.has(node.type)) return 1;
  if (node.type === 'SwitchCase') return node.test ? 1 : 0;
  if (node.type === 'LogicalExpression') return 1;
  return 0;
}

function children(node) {
  const out = [];
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key.endsWith('Comments')) continue;
    const value = node[key];
    if (Array.isArray(value)) out.push(...value.filter((v) => v && typeof v.type === 'string'));
    else if (value && typeof value.type === 'string') out.push(value);
  }
  return out;
}

function functionName(node, parent) {
  if (node.id?.name) return node.id.name;
  if (node.key?.name) return node.key.name;
  if (parent?.type === 'VariableDeclarator' && parent.id?.name) return parent.id.name;
  if (parent?.type === 'ObjectProperty' && parent.key?.name) return parent.key.name;
  return '(anonymous)';
}

/** Every function in one file: name, first line, length in lines and complexity. */
export function measureFunctions(text) {
  const ast = parse(text, { sourceType: 'module', plugins: ['typescript'], errorRecovery: true });
  const found = [];
  // Each stack entry is [node, parent, the function record it counts towards].
  const stack = [[ast.program, null, null]];
  while (stack.length) {
    const [node, parent, owner] = stack.pop();
    let counts = owner;
    if (FUNCTION_TYPES.has(node.type)) {
      const { start, end } = node.loc;
      counts = {
        name: functionName(node, parent),
        line: start.line,
        lines: end.line - start.line + 1,
        complexity: 1,
      };
      found.push(counts);
    } else if (counts) counts.complexity += decisions(node);
    for (const child of children(node)) stack.push([child, node, counts]);
  }
  return found.sort((a, b) => a.line - b.line);
}

const isTest = (file) => /\.(test|spec)\.ts$|(^|\/)tests\//.test(rel(file));

export function sourceFiles() {
  const keep = (f) => /\.(ts|mjs)$/.test(f) && !f.endsWith('.d.ts') && !isTest(f);
  return walk(path.join(root, 'src'), keep)
    .concat(walk(path.join(root, 'tools'), keep))
    .filter((f) => !rel(f).startsWith('src/content/data/'));
}

function moduleContracts() {
  const out = {};
  for (const layer of dirs(path.join(root, 'src')))
    for (const folder of [layer, ...dirs(layer)]) {
      const file = path.join(folder, 'MODULE.md');
      try {
        const bytes = readFileSync(file).length;
        if (bytes > thresholds.moduleBytes) out[rel(file)] = bytes;
      } catch {
        // a folder without a contract is check-limits' job
      }
    }
  return out;
}

/** Today's numbers, and the offenders behind each, for the report. */
export function measure() {
  const all = [];
  for (const file of sourceFiles())
    for (const f of measureFunctions(readFileSync(file, 'utf8')))
      all.push({ ...f, file: rel(file) });
  const label = (f) => `${f.file}:${f.line} ${f.name}`;
  const over = (test) =>
    all.filter(test).sort((a, b) => b.complexity - a.complexity || b.lines - a.lines);
  const long = over((f) => f.lines > thresholds.longLines);
  const high = over((f) => f.complexity > thresholds.complexHigh);
  const mid = over((f) => f.complexity > thresholds.complexMid);
  const copies = analyse(root, { since: '1.day' })
    .duplicates.filter((d) => d.identical > 1)
    .map((d) => `${d.name} (${d.identical} identical in ${d.files.length} files)`);
  const modules = moduleContracts();
  return {
    functions: all.length,
    counts: {
      longFunctions: long.length,
      complexOver25: high.length,
      complexOver15: mid.length,
      copiedHelpers: copies.length,
    },
    modules,
    lists: {
      longFunctions: long.map((f) => `${label(f)}: ${f.lines} lines`),
      complexOver25: high.map((f) => `${label(f)}: ${f.complexity}`),
      complexOver15: mid.map((f) => `${label(f)}: ${f.complexity}`),
      copiedHelpers: copies,
    },
  };
}

/** What rose above the baseline (failures) and what fell (the baseline can be lowered). */
export function compare(now, base) {
  const rose = [];
  const fell = [];
  for (const [key, value] of Object.entries(now.counts)) {
    const was = base.counts[key] ?? 0;
    if (value > was) rose.push(`${key}: ${value}, was ${was}`);
    else if (value < was) fell.push(`${key}: ${value}, was ${was}`);
  }
  for (const [file, bytes] of Object.entries(now.modules)) {
    const was = base.modules[file] ?? thresholds.moduleBytes;
    if (bytes > was) rose.push(`${file}: ${bytes} bytes, cap ${was}`);
    else if (bytes < was) fell.push(`${file}: ${bytes} bytes, was ${was}`);
  }
  for (const file of Object.keys(base.modules))
    if (!(file in now.modules)) fell.push(`${file}: now under ${thresholds.moduleBytes} bytes`);
  return { rose, fell };
}

function report(now, verbose) {
  const out = [`${now.functions} functions measured.`];
  for (const [key, value] of Object.entries(now.counts)) {
    out.push(`- ${key}: ${value}`);
    if (verbose) out.push(...now.lists[key].map((l) => `    ${l}`));
  }
  out.push(`- MODULE.md over ${thresholds.moduleBytes} bytes: ${Object.keys(now.modules).length}`);
  if (verbose) out.push(...Object.entries(now.modules).map(([f, b]) => `    ${f}: ${b} bytes`));
  return out.join('\n');
}

function writeBaseline(now, note) {
  const data = { note, ...now };
  delete data.functions;
  delete data.lists;
  writeFileSync(baselineFile, JSON.stringify(data, null, 2) + '\n');
}

function main() {
  const now = measure();
  const verbose = process.argv.includes('--list');
  const base = JSON.parse(readFileSync(baselineFile, 'utf8'));
  const { rose, fell } = compare(now, base);
  if (verbose) process.stdout.write(report(now, true) + '\n');
  if (rose.length) {
    process.stderr.write(
      `Shape ratchet FAIL: a count rose above tools/shape-baseline.json.\n  ${rose.join('\n  ')}\n` +
        'Split the function, import the existing helper, or trim the contract (`npm run shape -- --list`).\n',
    );
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes('--update') && fell.length) {
    writeBaseline(now, base.note);
    process.stdout.write(`Shape baseline lowered:\n  ${fell.join('\n  ')}\n`);
    return;
  }
  const note = fell.length
    ? ` Lower the baseline with \`npm run shape -- --update\`: ${fell.join('; ')}.`
    : '';
  process.stdout.write(`Shape ratchet passed.${note}\n`);
}

if (isMain(import.meta.url)) main();
