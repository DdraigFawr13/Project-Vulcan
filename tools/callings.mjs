// `npm run callings` (6B Bundle 6, V-189 q8 and q9): game years on each test seed with the default
// levers, and one table of the callings: who took which and when, with the line; masterworks; and
// at the end, for each calling, how many living grown-ups pass each test of its bar and the best
// measure, so a bar that never passes shows which test holds it back. Reads state only; about a
// minute a seed-year; not part of `npm run check` or CI (RULES VR-25).
// Seeds and years: `npm run callings -- anvil smoke -- 10`; one seed a process.
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, renderEvent, barsOf, grown } = engine;
const args = process.argv.slice(2);
const cut = args.indexOf('--');
const seeds = (cut < 0 ? args : args.slice(0, cut)).filter(Boolean);
const years = cut < 0 ? 10 : Number(args[cut + 1] ?? 10);
const YEAR = 336;
const SHOWN = new Set(['calling.taken', 'calling.masterwork']);

for (const seed of seeds.length ? seeds : ['anvil', 'smoke', 'tallow', 'ledger-1']) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  const names = (id) => w.entities.person.find((p) => p.id === id)?.name ?? `#${id}`;
  const shown = [];
  for (let day = 0; day < YEAR * years; day += 1)
    for (const line of step(w, sim, 24 * 60))
      if (SHOWN.has(line.type))
        shown.push(
          `y${Math.floor(day / YEAR) + 1} d${(day % YEAR) + 1}: ${renderEvent(line, sim.templates, names)}`,
        );
  const living = w.entities.person.filter((p) => p.status === 'alive' && grown(w, content, p));
  console.log(
    `${seed}: ${years} years, ${living.length} grown and living, ${shown.length} calling lines`,
  );
  for (const l of shown) console.log(`  ${l}`);
  const bars = living.map((p) => barsOf(w, content, p.id));
  for (const [i, def] of content.callings.callings.entries()) {
    const tests = def.stages[0].bar.map((t, k) => {
      const ms = bars.map((b) => b[i].measures[k]);
      const best = Math.max(0, ...ms.map((m) => m.score));
      return `${t.test}${t.event ? ` ${t.event}` : ''} ${ms.filter((m) => m.pass).length} pass (best ${best})`;
    });
    const all = bars.filter((b) => b[i].measures.every((m) => m.pass)).length;
    console.log(`  ${def.id}: ${tests.join('; ')}; all ${all}`);
  }
}
