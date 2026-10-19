// `npm run balance` (P4.9, the `balance-check` skill): one game year, from the first spring to the
// next, on each test seed with the default levers, and one numbers table against Phase 4's balance
// lines. Reads state only; changes nothing. About 20 s a seed (measured 2026-10-19); not part of
// `npm run check` or CI (RULES VR-25). Seeds: `npm run balance -- anvil smoke`.
import { engine } from './engine.mjs';

const { createSim, createWorld, growSpot, step, content, TICKS_PER_DAY } = engine;
const seeds = process.argv.slice(2).length ? process.argv.slice(2) : ['anvil', 'smoke', 'tallow'];
const YEAR = 336;
const HOUR = 60;
// The lines each row is held to (PHASE_4.md P4.9, V-092, the Phase 3 review's 450 cold lines).
const LIMITS = { alive: 5, coldNotable: 450 };

const rows = [];
for (const seed of seeds) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  const lowDays = { food: new Set(), rest: new Set(), warmth: new Set(), privacy: new Set() };
  let minWarmth = Infinity;
  let minMood = Infinity;
  // Days the store ends full: no empty tile and no room to grow, so felled logs and dug stone stay out.
  let fullDays = 0;
  const notable = new Map();
  // The day each step of the metal chain first happens, with the default levers (Morgan's worn-tool
  // card): a tool worn, a shaft planned, ore mined, an ingot smelted, the smithy built, a tool made.
  const firsts = {
    'tool.worn': 0,
    'mine.shaftPlanned': 0,
    'mine.veinMined': 0,
    'metal.smelted': 0,
    'smithy.built': 0,
    'smith.made': 0,
  };
  for (let day = 0; day < YEAR; day += 1) {
    for (let h = 0; h < 24; h += 1) {
      for (const line of step(w, sim, HOUR)) {
        if (firsts[line.type] === 0) firsts[line.type] = day + 1;
        if (!sim.notable(line)) continue;
        const key = line.type === 'need.low' ? `need.low ${line.data.need}` : line.type;
        notable.set(key, (notable.get(key) ?? 0) + 1);
      }
      for (const n of w.entities.need) {
        if (n.low && lowDays[n.need]) lowDays[n.need].add(`${n.person}/${day}`);
        if (n.need === 'warmth') minWarmth = Math.min(minWarmth, n.value);
      }
      for (const m of w.entities.mood) minMood = Math.min(minMood, m.value);
    }
    const taken = new Set(
      w.entities.item.filter((i) => !i.holder).map((i) => `${i.x},${i.y},${i.z}`),
    );
    const empty = w.entities.store.some((s) => !taken.has(`${s.x},${s.y},${s.z}`));
    if (!empty && !growSpot(w, content)) fullDays += 1;
  }
  const alive = w.entities.person.filter((p) => p.status === 'alive').length;
  const goods = (kind) =>
    w.entities.item.filter((i) => i.kind === kind && !i.holder).reduce((n, i) => n + i.count, 0);
  const food = content.items.filter((i) => i.good === 'food').map((i) => i.id);
  const total = [...notable.values()].reduce((a, b) => a + b, 0);
  const top = [...notable].sort((a, b) => b[1] - a[1]).slice(0, 4);
  rows.push({
    seed,
    alive,
    hungryDays: lowDays.food.size,
    tiredDays: lowDays.rest.size,
    coldDays: lowDays.warmth.size,
    crowdedDays: lowDays.privacy.size,
    coldNotable: notable.get('need.low warmth') ?? 0,
    notable: total,
    minWarmth,
    minMood,
    food: food.reduce((n, k) => n + goods(k), 0),
    fullDays,
    houses: w.entities.house.filter((x) => x.state === 'built').length,
    top: top.map(([k, v]) => `${k} ${v}`).join(', '),
    days: w.tick / TICKS_PER_DAY,
    metal: Object.entries(firsts)
      .map(([k, d]) => `${k} ${d || '-'}`)
      .join(', '),
  });
}

const cols = Object.keys(rows[0]).filter((k) => k !== 'top' && k !== 'metal');
process.stdout.write(`${cols.join(' | ')}\n`);
for (const r of rows) process.stdout.write(`${cols.map((c) => r[c]).join(' | ')}\n`);
for (const r of rows) process.stdout.write(`${r.seed} most notable: ${r.top}\n`);
for (const r of rows) process.stdout.write(`${r.seed} metal chain, first day: ${r.metal}\n`);
const misses = rows.filter((r) => r.alive < LIMITS.alive || r.coldNotable >= LIMITS.coldNotable);
const reached = rows.length - rows.filter((r) => r.alive < LIMITS.alive).length;
process.stdout.write(`${reached} of ${rows.length} seeds reach spring with five alive\n`);
if (misses.length) process.stdout.write(`miss: ${misses.map((r) => r.seed).join(', ')}\n`);
