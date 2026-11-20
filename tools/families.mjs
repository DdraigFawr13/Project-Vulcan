// `npm run families` (P6.1, the Bundle 1 done-when): ten game years on each test seed with the
// default levers, and one table of what families did: courtships, weddings, feasts, the living each
// year, wed couples sleeping under one roof at the end, and the first lines and every death. Reads state only; changes nothing.
// About a minute a seed-year on a 4-core container; not part of `npm run check` or CI (RULES VR-25).
// Seeds and years: `npm run families -- anvil smoke -- 10` (years after a second `--`).
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, renderEvent } = engine;
const args = process.argv.slice(2);
const cut = args.indexOf('--');
const seeds = (cut < 0 ? args : args.slice(0, cut)).filter(Boolean);
const years = cut < 0 ? 10 : Number(args[cut + 1] ?? 10);
const YEAR = 336;
const COUNTED = [
  'family.courting',
  'family.parted',
  'family.wed',
  'family.feast',
  'family.noFeast',
];

for (const seed of seeds.length ? seeds : ['anvil', 'smoke', 'tallow', 'ledger-1']) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  const names = (id) => w.entities.person.find((p) => p.id === id)?.name ?? `#${id}`;
  const counts = Object.fromEntries(COUNTED.map((k) => [k, 0]));
  const firsts = [];
  const deaths = [];
  const byYear = [];
  for (let day = 0; day < YEAR * years; day += 1) {
    for (let h = 0; h < 24; h += 1)
      for (const line of step(w, sim, 60)) {
        if (line.type === 'health.died')
          deaths.push(
            `y${Math.floor(day / YEAR) + 1} d${(day % YEAR) + 1}: ${renderEvent(line, sim.templates, names)}`,
          );
        if (!(line.type in counts)) continue;
        counts[line.type] += 1;
        if (firsts.length < 8)
          firsts.push(
            `y${Math.floor(day / YEAR) + 1} d${(day % YEAR) + 1}: ${renderEvent(line, sim.templates, names)}`,
          );
      }
    if (day % YEAR === YEAR - 1)
      byYear.push(w.entities.person.filter((p) => p.status === 'alive').length);
  }
  const sleeps = (id) => engine.sleepsIn(w, content, id)?.id ?? 0;
  const wed = w.entities.person.filter(
    (p) => p.status === 'alive' && p.partner && p.id < p.partner,
  );
  const together = wed.filter((p) => {
    const q = w.entities.person.find((x) => x.id === p.partner);
    return q?.status === 'alive' && sleeps(p.id) && sleeps(p.id) === sleeps(q.id);
  }).length;
  const drawn = w.entities.person.map((p) => `${p.sex}:${p.orientation}`).join(' ');
  const row = { seed, years, alive: byYear.join(' '), ...counts, underOneRoof: together, drawn };
  console.log(JSON.stringify(row));
  for (const f of [...firsts, ...deaths]) console.log(`  ${f}`);
}
