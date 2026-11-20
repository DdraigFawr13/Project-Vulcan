import { engine } from './engine.mjs';
const { createSim, createWorld, step, content } = engine;
const [seed, years = '2'] = process.argv.slice(2);
const sim = createSim(content);
const w = createWorld(sim, seed);
const by = {};
const fill = (s, words) => s.replace(/\{(\w+)\}/g, (_, k) => words?.[k] ?? `{${k}}`);
const tops = [];
const snap = (y) => {
  const alive = new Set(w.entities.person.filter((p) => p.status === 'alive').map((p) => p.id));
  const holders = {};
  for (const t of w.entities.tale ?? [])
    if (alive.has(t.person)) (holders[t.story] ??= []).push(t.level);
  const rows = (w.entities.story ?? [])
    .map((s) => {
      const def = content.tales.tales.find((d) => d.id === s.tale);
      const lv = holders[s.id] ?? [];
      const top = lv.length ? lv.sort((a, b) => b - a)[Math.floor(lv.length / 2)] : 0;
      return {
        y,
        tale: s.tale,
        held: lv.length,
        of: alive.size,
        text: def ? fill(def.levels[top] ?? '', s.words) : '',
      };
    })
    .sort((a, b) => b.held - a.held)
    .slice(0, 4);
  tops.push(...rows);
};
for (let day = 0; day < 336 * Number(years); day += 1) {
  for (let h = 0; h < 24; h += 1)
    for (const line of step(w, sim, 60)) {
      if (line.type !== 'tale.told') continue;
      const k = `y${Math.floor(day / 336) + 1}${line.data.where || ' strolling'}`;
      by[k] = (by[k] ?? 0) + 1;
    }
  if (day % 336 === 335) snap(Math.floor(day / 336) + 1);
}
console.log(JSON.stringify({ seed, by, tops }, null, 1));
