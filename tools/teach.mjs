// `npm run teach` (6B Bundle 6, V-189): game years on each test seed with the default levers, and
// one table of how skills grew: rises a year, how many reach the master level (8) and 12 in any
// skill, apprentices bound and finished, taught rises and masters lost, with the first lines.
// Reads state only. About a minute a seed-year; not part of `npm run check` or CI (RULES VR-25).
// Seeds and years: `npm run teach -- anvil smoke -- 2` (years after a second `--`); one seed a
// process, so run seeds in parallel shells for speed.
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, renderEvent } = engine;
const args = process.argv.slice(2);
const cut = args.indexOf('--');
const seeds = (cut < 0 ? args : args.slice(0, cut)).filter(Boolean);
const years = cut < 0 ? 2 : Number(args[cut + 1] ?? 2);
const YEAR = 336;
const COUNTED = [
  'skill.rose',
  'skill.taught',
  'teach.apprentice',
  'teach.finished',
  'teach.parted',
  'teach.lost',
  'build.school',
  'school.teacher',
  'school.writing',
  'school.book',
  'skill.read',
  'school.bookLost',
];
const SHOWN = new Set([
  'teach.apprentice',
  'teach.finished',
  'teach.lost',
  'build.school',
  'school.book',
  'school.bookLost',
]);

for (const seed of seeds.length ? seeds : ['anvil', 'smoke', 'tallow', 'ledger-1']) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  const names = (id) => w.entities.person.find((p) => p.id === id)?.name ?? `#${id}`;
  const counts = Object.fromEntries(COUNTED.map((k) => [k, 0]));
  const shown = [];
  const rises = [];
  let rose = 0;
  let helped = 0;
  for (let day = 0; day < YEAR * years; day += 1) {
    for (let h = 0; h < 24; h += 1) {
      helped += w.entities.person.filter((p) => p.status === 'alive' && p.job === 'help').length;
      for (const line of step(w, sim, 60)) {
        if (!(line.type in counts)) continue;
        counts[line.type] += 1;
        if (line.type.startsWith('skill.')) rose += 1;
        if (SHOWN.has(line.type) && shown.length < 14)
          shown.push(
            `y${Math.floor(day / YEAR) + 1} d${(day % YEAR) + 1}: ${renderEvent(line, sim.templates, names)}`,
          );
      }
    }
    if (day % YEAR === YEAR - 1) (rises.push(rose), (rose = 0));
  }
  const living = w.entities.person.filter((p) => p.status === 'alive');
  const best = (p) =>
    Math.max(0, ...w.entities.skill.filter((s) => s.person === p.id).map((s) => s.level));
  const at = (n) => living.filter((p) => best(p) >= n).length;
  console.log(
    `${seed}: living ${living.length}; reach 8+ ${at(8)}, 12+ ${at(12)}; rises/yr ${rises.join(' / ')}; hours beside a master ${helped}; ` +
      COUNTED.map((k) => `${k.split('.')[1]} ${counts[k]}`).join(', '),
  );
  for (const p of living)
    console.log(
      `  ${p.name}: ${w.entities.skill
        .filter((s) => s.person === p.id)
        .sort((a, b) => b.level - a.level)
        .slice(0, 3)
        .map((s) => `${s.skill} ${s.level}/${s.potential}`)
        .join(', ')}`,
    );
  for (const l of shown) console.log(`  ${l}`);
}
