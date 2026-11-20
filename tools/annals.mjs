// `npm run annals` (Phase 6T slice 2, V-191): one game year on each seed with the default levers,
// then every recap the annals wrote, each sentence followed by the ledger lines it cites. Reads
// state only. About 90 s a seed (measured 2026-11-20); not part of `npm run check` or CI.
// Seeds: `npm run annals -- anvil smoke`; `--years 2` runs longer.
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, annalsOf, recordOf, renderEvent, tableOf } = engine;
const args = process.argv.slice(2);
const at = args.indexOf('--years');
const years = at >= 0 ? Number(args.splice(at, 2)[1]) : 1;
const seeds = args.length ? args : ['anvil', 'smoke', 'tallow', 'ledger-1'];
const DAY = 1440;

for (const seed of seeds) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  const started = performance.now();
  for (let d = 0; d < 336 * years; d += 1) step(w, sim, DAY);
  const secs = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`\n# ${seed}: ${years} year(s), ${secs} s\n`);
  for (const a of [...annalsOf(w)].reverse()) {
    console.log(`## ${a.title}`);
    for (const t of tableOf(w, 'annalText').filter((x) => x.annal === a.id)) {
      console.log(`- [${t.section}] ${t.text}`);
      const cites = t.lines.map((id) => {
        const r = recordOf(w, id);
        if (!r) return `#${id} (gone)`;
        return 'data' in r ? `#${id} ${renderEvent(r, sim.templates)}` : `#${id} (stub)`;
      });
      for (const c of cites.slice(0, 3)) console.log(`    cites ${c}`);
      if (cites.length > 3) console.log(`    cites ${cites.length - 3} more`);
    }
    console.log('');
  }
}
