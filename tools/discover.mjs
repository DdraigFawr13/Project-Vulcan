// `npm run discover` (6C Slice 5, V-218): game years on one test seed with the default levers, and
// one table of the colony's discoveries: puzzles begun, hints by kind, finds, ways beaten to,
// with every find and its year. Reads state only; not part of `npm run check` or CI (RULES VR-25).
// `npm run discover -- anvil 10`; one seed a process, so run seeds in parallel shells.
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, renderEvent } = engine;
const [seed = 'anvil', yearsArg = '2'] = process.argv.slice(2);
const years = Number(yearsArg);
const YEAR = 336;
const sim = createSim(content);
const w = createWorld(sim, seed);
const counts = {};
const kinds = {};
const shown = [];
const t0 = Date.now();
for (let y = 0; y < years; y += 1)
  for (let d = 0; d < YEAR; d += 1)
    for (let h = 0; h < 24; h += 1)
      for (const line of step(w, sim, 60)) {
        if (!line.type.startsWith('discover.')) continue;
        counts[line.type] = (counts[line.type] ?? 0) + 1;
        if (line.type === 'discover.hint') kinds[line.data.kind] = (kinds[line.data.kind] ?? 0) + 1;
        if (line.type !== 'discover.hint')
          shown.push(
            `y${y + 1} d${d + 1} ${renderEvent(line, sim.templates, (id) => w.entities.person.find((p) => p.id === id)?.name ?? '?')}`,
          );
      }
const alive = w.entities.person.filter((p) => p.status === 'alive').length;
console.log(`${seed}, ${years} years (${Math.round((Date.now() - t0) / 1000)} s), ${alive} living`);
console.log(JSON.stringify({ counts, kinds }));
for (const s of shown) console.log(s);
