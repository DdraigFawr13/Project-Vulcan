#!/usr/bin/env node
// Refactor hotspots: which files to look at first, and helpers defined in more than one place.
// Report only: it always exits 0 unless git itself fails. Run from the project root:
//   node .claude/skills/refactor/scripts/hotspots.mjs [--since=6.months] [--top=15]
//        [--max-lines=400] [--max-bytes=16384] [--json]
// Sections:
//   1. Hotspots: commits touching the file since --since, times its lines (Tornhill's churn x size).
//   2. Oversize: files over --max-lines or --max-bytes (a line cap alone is gamed by long lines).
//   3. Duplicate helpers: a top-level function name defined in two or more files, with how many
//      bodies are identical once spacing is removed (Story-Generator #80 and #144 each removed copies
//      of `clamp`). Identical copies come first.
// Known limits, each of which can only miss a hit or list a harmless one:
//   - duplicates are found by name first; a copy under a new name is missed, and comments or
//     renamed parameters make copies count as different;
//   - JS/TS and Python definitions only; methods inside classes are skipped;
//   - git rename history is not followed, so a moved file's churn restarts at the move.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.py', '.gd', '.cs', '.go', '.rs', '.java', '.kt', '.swift', '.vue', '.svelte']);
// Paths that are generated, vendored or synced: never refactor targets.
export const SKIP = [/(^|\/)node_modules\//, /(^|\/)dist\//, /(^|\/)build\//, /(^|\/)coverage\//, /(^|\/)vendor\//, /^\.claude\//, /\.min\./, /\.d\.[mc]?ts$/, /(^|\/)\.git\//];
// Names too generic to mean a copied helper.
export const COMMON = new Set(['main', 'run', 'init', 'setup', 'render', 'default', 'handler', 'constructor', 'test', 'it', 'describe', 'helper', 'parse', 'load', 'start', 'stop', 'update', 'reset', 'create', 'get', 'set', 'build', 'check', 'fail', 'log', 'usage', '__init__']);

const JS_DEFS = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/,
];
const PY_DEF = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;

export function parseArgs(argv) {
  const o = { since: '6.months', top: 15, maxLines: 400, maxBytes: 16384, json: false };
  for (const a of argv) {
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'since') o.since = v;
    else if (k === 'top') o.top = Number(v);
    else if (k === 'max-lines') o.maxLines = Number(v);
    else if (k === 'max-bytes') o.maxBytes = Number(v);
    else if (k === 'json') o.json = true;
  }
  return o;
}

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

export function isSource(file) {
  return SOURCE_EXT.has(path.extname(file)) && !SKIP.some((re) => re.test(file));
}

/** Top-level function definitions in one file's text: name -> body without `export` or spacing.
 *  Only unindented definitions count; a body runs to the next unindented line that does not close it. */
export function definitions(file, text) {
  const ext = path.extname(file);
  const lines = text.split('\n');
  const defs = new Map();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s/.test(line)) continue; // nested or inside a class
    let name;
    if (ext === '.py') name = PY_DEF.exec(line)?.[1];
    else for (const re of JS_DEFS) if ((name = re.exec(line)?.[1])) break;
    if (!name || defs.has(name)) continue;
    let j = i + 1;
    while (j < lines.length && (lines[j] === '' || /^\s/.test(lines[j]) || /^[\]})]/.test(lines[j]))) j++;
    defs.set(name, lines.slice(i, j).join('\n').replace(/^export\s+(default\s+)?/, '').replace(/\s+/g, ''));
  }
  return defs;
}

export function analyse(cwd, opts) {
  const files = git(cwd, ['ls-files']).split('\n').filter(Boolean).filter(isSource);
  const churn = new Map();
  const log = git(cwd, ['log', `--since=${opts.since}`, '--format=', '--name-only', '--no-renames']);
  for (const f of log.split('\n')) if (f) churn.set(f, (churn.get(f) ?? 0) + 1);

  const rows = [];
  const defs = new Map();
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(path.join(cwd, f), 'utf8');
    } catch {
      continue; // listed by git but missing from the work tree
    }
    const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    const bytes = Buffer.byteLength(text);
    const commits = churn.get(f) ?? 0;
    rows.push({ file: f, lines, bytes, commits, score: commits * lines });
    if (/(^|\/)(tests?|e2e|__tests__|fixtures?)\/|\.(test|spec)\./.test(f)) continue; // test and fixture copies are deliberate
    for (const [n, body] of definitions(f, text)) {
      if (COMMON.has(n) || n.length < 4) continue;
      if (!defs.has(n)) defs.set(n, []);
      defs.get(n).push({ file: f, body });
    }
  }
  const hotspots = rows.filter((r) => r.commits > 0).sort((a, b) => b.score - a.score || a.file.localeCompare(b.file)).slice(0, opts.top);
  const oversize = rows.filter((r) => r.lines > opts.maxLines || r.bytes > opts.maxBytes).sort((a, b) => b.lines - a.lines);
  const duplicates = [...defs]
    .filter(([, where]) => where.length > 1)
    .map(([name, where]) => {
      const groups = new Map();
      for (const w of where) groups.set(w.body, (groups.get(w.body) ?? 0) + 1);
      return { name, identical: Math.max(...groups.values()), files: where.map((w) => w.file).sort() };
    })
    .sort((a, b) => b.identical - a.identical || b.files.length - a.files.length || a.name.localeCompare(b.name));
  return { files: rows.length, since: opts.since, hotspots, oversize, duplicates };
}

export function format(r, opts) {
  const out = [`# Refactor hotspots`, ``, `${r.files} source files; churn since ${r.since}. Report only.`, ``, `## Hotspots (commits x lines)`];
  if (!r.hotspots.length) out.push('- none: no source file changed in the window');
  for (const h of r.hotspots) out.push(`- ${h.file}: ${h.commits} commits x ${h.lines} lines = ${h.score}`);
  out.push('', `## Oversize (over ${opts.maxLines} lines or ${opts.maxBytes} bytes)`);
  if (!r.oversize.length) out.push('- none');
  for (const o of r.oversize) out.push(`- ${o.file}: ${o.lines} lines, ${o.bytes} bytes`);
  const copies = r.duplicates.filter((d) => d.identical > 1);
  out.push('', `## Duplicate helpers: ${copies.length} names with identical copies, ${r.duplicates.length - copies.length} more sharing only a name`);
  if (!r.duplicates.length) out.push('- none');
  for (const d of r.duplicates.slice(0, opts.top * 2))
    out.push(`- ${d.name}: ${d.files.length} files, ${d.identical > 1 ? `${d.identical} identical` : 'bodies differ'}: ${d.files.join(', ')}`);
  if (r.duplicates.length > opts.top * 2) out.push(`- ... ${r.duplicates.length - opts.top * 2} more (--json lists all)`);
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  const r = analyse(process.cwd(), opts);
  console.log(opts.json ? JSON.stringify(r, null, 2) : format(r, opts));
}
