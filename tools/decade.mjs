// `npm run decade` (6B balance): ten game years on one test seed with the default levers; writes one
// JSON of every line type counted by year, the living each year, chosen lines rendered, and the
// calling bars at the end. Reads state only. On the 250-tile valley 17 to 44 min a seed for ten years with four seeds in parallel on a 4-core container (2026-11-22).
// `npm run decade -- anvil 10 tmp/decade-anvil.json`; one seed a process, seeds in parallel shells.
import { writeFileSync } from 'node:fs';
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, renderEvent, barsOf, grown } = engine;
const [seed = 'anvil', yearsArg = '10', out = `tmp/decade-${seed}.json`] = process.argv.slice(2);
const years = Number(yearsArg);
const YEAR = 336;
const KEEP =
  /^(family\.(wed|born|left)|health\.died|calling\.|build\.(stageWanted|stageWaits|rebuilt|laidDry)|mason\.slated|faith\.|feast|law\.|tavern\.|byname|school|teach\.bond|fire\.stoked|lime\.burned|tale\.byname|teach\.apprentice)/;
const sim = createSim(content);
const w = createWorld(sim, seed);
const names = (id) => w.entities.person.find((p) => p.id === id)?.name ?? `#${id}`;
const byYear = [];
const lines = [];
const goods = (kind) =>
  w.entities.item.filter((i) => i.kind === kind && !i.holder).reduce((n, i) => n + i.count, 0);
const t0 = Date.now();
for (let y = 0; y < years; y += 1) {
  const counts = {};
  for (let d = 0; d < YEAR; d += 1)
    for (let h = 0; h < 24; h += 1)
      for (const line of step(w, sim, 60)) {
        counts[line.type] = (counts[line.type] ?? 0) + 1;
        if (KEEP.test(line.type) && lines.length < 2000)
          lines.push(
            `y${y + 1} d${d + 1} ${line.type}: ${renderEvent(line, sim.templates, names)}`,
          );
      }
  const alive = w.entities.person.filter((p) => p.status === 'alive');
  // Firewood each house burned in the winter just past (build/stages.ts), with its walls.
  const winter = (w.entities.house ?? [])
    .filter((h) => !h.of && h.burnYear >= 0)
    .map((h) => `${h.id}:${h.wall}:${h.burned}${h.stage ? `:${h.stage}` : ''}`);
  byYear.push({
    year: y + 1,
    alive: alive.length,
    grown: alive.filter((p) => grown(w, content, p)).length,
    firewood: goods('firewood'),
    stone: goods('stone'),
    lime: goods('lime'),
    clay: goods('clay'),
    winter,
    counts,
    secs: Math.round((Date.now() - t0) / 1000),
  });
  writeFileSync(out, JSON.stringify({ seed, byYear, lines }, null, 1));
  console.log(
    `${seed} y${y + 1} alive ${alive.length} (${Math.round((Date.now() - t0) / 1000)} s)`,
  );
}
const living = w.entities.person.filter((p) => p.status === 'alive' && grown(w, content, p));
const bars = living.map((p) => ({ name: p.name, bars: barsOf(w, content, p.id) }));
const houses = (w.entities.house ?? [])
  .filter((h) => !h.of)
  .map((h) => ({ id: h.id, state: h.state, roof: h.roof, stage: h.stage, wall: h.wall }));
// Bynames with their holders, and who holds the kept roles (6B review, V-206).
const bynames = (w.entities.byname ?? []).map((b) => ({
  word: b.word,
  name: names(b.person),
  alive: w.entities.person.find((p) => p.id === b.person)?.status === 'alive',
}));
const roles = {
  keeper: (w.entities.tavern ?? []).map((t) => names(t.keeper)),
  teacher: (w.entities.school ?? []).map((s) => names(s.teacher)),
};
writeFileSync(out, JSON.stringify({ seed, byYear, lines, bars, houses, bynames, roles }, null, 1));
