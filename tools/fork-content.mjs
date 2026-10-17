// Forks the Story Generator content into src/content/data/ (P0.2, DECISIONS V-008).
// Usage: node tools/fork-content.mjs [--from ../Story-Generator] [--force]
// The fork is a one-time copy that Vulcan then edits as its own, so the tool refuses to
// overwrite existing data unless --force is given (which discards those edits).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';

export const dataDir = path.join(root, 'src/content/data');
const forkDoc = path.join(root, 'src/content/FORK.md');

/** Each forked file: its Story Generator source and how to read it from the loaded modules. */
export const FILES = [
  [
    'calendar',
    'src/engine/core/clock.ts',
    ({ clock }) => ({
      daysPerWeek: clock.DAYS_PER_WEEK,
      daysPerMonth: clock.DAYS_PER_MONTH,
      monthsPerYear: clock.MONTHS_PER_YEAR,
      seasons: clock.SEASONS,
      monthNames: clock.MONTH_NAMES,
    }),
  ],
  ['tiers', 'src/engine/people/tiers.ts', ({ tiers }) => Object.values(tiers.TIERS)],
  ['biomes', 'src/content/biomes.ts', ({ c }) => ({ biomes: c.biomes, rules: c.biomeRules })],
  ['resources', 'src/content/resources.ts', ({ c }) => c.resources],
  ['weather', 'src/content/world.ts', ({ c }) => c.weather],
  ['races', 'src/content/races.ts', ({ c }) => c.races],
  ['cultures', 'src/content/cultures.ts', ({ c }) => c.cultures],
  ['names', 'src/content/names.ts', ({ c }) => c.names],
  ['schools', 'src/content/abilities.ts', ({ c }) => c.schools],
  ['abilities', 'src/content/abilities.ts', ({ c }) => c.abilities],
  ['awakenings', 'src/content/awakenings.ts', ({ c }) => c.awakenings],
  ['lore', 'src/content/lore.ts', ({ c }) => c.lore],
  ['faiths', 'src/content/faiths.ts', ({ c }) => c.faiths],
  ['great-works', 'src/content/great-works.ts', ({ c }) => c.greatWorks],
  ['creatures', 'src/content/creatures.ts', ({ c }) => c.creatures],
  ['dragons', 'src/content/dragons.ts', ({ c }) => c.dragons],
  ['items', 'src/content/items.ts', ({ c }) => c.items],
  ['needs', 'src/content/life.ts', ({ c }) => c.needs],
  ['traits', 'src/content/life.ts', ({ c }) => c.traits],
  ['memories', 'src/content/life.ts and five other files', ({ c }) => c.memories],
  ['jobs', 'src/content/jobs.ts', ({ c }) => c.jobs],
  ['conditions', 'src/content/health.ts', ({ c }) => c.conditions],
  ['ailments', 'src/content/health.ts', ({ c }) => c.ailments],
  ['diseases', 'src/content/diseases.ts', ({ c }) => c.diseases],
];

/** One list entry or one top-level field per line, so a diff shows which entry changed. */
export function formatData(value) {
  const line = (v) =>
    JSON.stringify(v, (_, x) => {
      if (typeof x === 'function') throw new Error('content holds a function; fork data only');
      return x;
    });
  if (Array.isArray(value)) return `[\n${value.map((v) => `  ${line(v)}`).join(',\n')}\n]\n`;
  const fields = Object.entries(value).map(([k, v]) => `  ${JSON.stringify(k)}: ${line(v)}`);
  return `{\n${fields.join(',\n')}\n}\n`;
}

export const entryCount = (v) => (Array.isArray(v) ? v.length : Object.keys(v).length);

async function fork(from, force) {
  if (!existsSync(path.join(from, 'src/content/index.ts')))
    throw new Error(`${from} is not a Story Generator checkout`);
  if (existsSync(dataDir) && !force)
    throw new Error('src/content/data exists; --force overwrites it and loses Vulcan edits');
  const git = (...a) => execFileSync('git', ['-C', from, ...a], { encoding: 'utf8' }).trim();
  const commit = git('rev-parse', 'HEAD');
  const date = git('show', '-s', '--format=%cs', 'HEAD');
  if (git('status', '--porcelain', 'src')) throw new Error(`${from} has uncommitted changes`);

  const { runnerImport } = await import('vite');
  const load = async (file) =>
    (
      await runnerImport(path.join(from, file), {
        root: from,
        configFile: false,
        logLevel: 'silent',
      })
    ).module;
  const modules = {
    c: (await load('src/content/index.ts')).DEFAULT_CONTENT,
    clock: await load('src/engine/core/clock.ts'),
    tiers: await load('src/engine/people/tiers.ts'),
  };

  mkdirSync(dataDir, { recursive: true });
  const rows = [];
  for (const [name, source, pick] of FILES) {
    const value = pick(modules);
    writeFileSync(path.join(dataDir, `${name}.json`), formatData(value));
    rows.push(`| ${name}.json | ${source} | ${entryCount(value)} |`);
  }
  const record = [
    '<!-- fork:start (written by tools/fork-content.mjs) -->',
    `Source: DdraigFawr13/Story-Generator at \`${commit}\` (${date}).`,
    '',
    '| File | From | Entries at fork |',
    '| --- | --- | --- |',
    ...rows,
    '<!-- fork:end -->',
  ].join('\n');
  const doc = existsSync(forkDoc) ? readFileSync(forkDoc, 'utf8') : `# Content fork\n\n${record}\n`;
  writeFileSync(forkDoc, doc.replace(/<!-- fork:start[\s\S]*<!-- fork:end -->/, record));
  process.stdout.write(
    `Forked ${FILES.length} files from ${commit.slice(0, 7)} into src/content/data.\n`,
  );
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--from');
  const from = path.resolve(at >= 0 ? args[at + 1] : path.join(root, '../Story-Generator'));
  fork(from, args.includes('--force')).catch((e) => {
    process.stderr.write(`fork-content: ${e.message}\n`);
    process.exitCode = 1;
  });
}
