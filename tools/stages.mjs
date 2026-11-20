// `npm run stages` (6B Bundle 3, the P6.9 done-when): ten game years on each test seed with the
// default levers, and what the houses' stages did: stages wanted (by stage, each with the line
// naming its cause), what they waited on, walls rebuilt, roofs slated, walls washed, and the
// living each year. Reads state only; changes nothing. About a minute a seed-year on a 4-core
// container; not part of `npm run check` or CI (RULES VR-25). Run seeds in parallel shells.
// Seeds and years: `npm run stages -- anvil smoke -- 10` (years after a second `--`).
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, renderEvent } = engine;
const args = process.argv.slice(2);
const cut = args.indexOf('--');
const seeds = (cut < 0 ? args : args.slice(0, cut)).filter(Boolean);
const years = cut < 0 ? 10 : Number(args[cut + 1] ?? 10);
const YEAR = 336;
const SHOWN = new Set([
  'build.stageWanted',
  'build.stageWaits',
  'build.rebuilt',
  'mason.slated',
  'mason.washed',
  'build.roofed',
]);
const COUNTED = [...SHOWN, 'mason.split', 'mason.dressed', 'mason.walled', 'lime.broke'];

for (const seed of seeds.length ? seeds : ['anvil', 'smoke', 'tallow', 'ledger-1']) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  const names = (id) => w.entities.person.find((p) => p.id === id)?.name ?? `#${id}`;
  const counts = Object.fromEntries([...COUNTED, 'lime.burned'].map((k) => [k, 0]));
  const lines = [];
  const living = [];
  for (let day = 0; day < YEAR * years; day += 1) {
    for (let h = 0; h < 24; h += 1)
      for (const line of step(w, sim, 60)) {
        if (!(line.type in counts)) continue;
        counts[line.type] += 1;
        if (SHOWN.has(line.type) && lines.length < 40)
          lines.push(
            `y${Math.floor(day / YEAR) + 1} d${(day % YEAR) + 1}: ${renderEvent(line, sim.templates, names)}`,
          );
      }
    if (day % YEAR === YEAR - 1)
      living.push(w.entities.person.filter((p) => p.status === 'alive').length);
  }
  const houses = (w.entities.house ?? []).filter((h) => !h.of);
  const roofs = {};
  for (const h of houses) roofs[h.roof || 'none'] = (roofs[h.roof || 'none'] ?? 0) + 1;
  const open = houses.filter((h) => h.stage).map((h) => h.stage);
  console.log(JSON.stringify({ seed, years, living, counts, roofs, openStages: open }));
  for (const l of lines) console.log(`  ${l}`);
}
