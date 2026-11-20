// `npm run heat` (6B Bundle 2, P6.10 done-when): two tables on each seed. Cooling: the first room
// with a hearth after a few winter days, rebuilt in timber, clay daub and stone, its air brought to
// what a lit fire holds it at, then the fire put out: hours until the room is under 5 degrees of
// air heat and until it is cold. Hearths: from day 10 of a -12 degree winter, each Hearths setting
// for 14 days with no other orders: firewood burned, person-hours cold, answers and the law lines.
// Reads state and puts fires out only in its own copies; not part of `npm run check` or CI.
// Seeds: `npm run heat -- anvil smoke tallow`.
import { engine } from './engine.mjs';

const { createSim, createWorld, step, submitCommand, content: game } = engine;
const { airHour, airOf, leakOf, firesOf, furnitureOf, roomAt } = engine;
const seeds = process.argv.slice(2).filter(Boolean);
const DAY = 1440;
const calm = engine.withoutAccidents(game);
const cold = (deg) => ({
  ...calm,
  seasons: { ...calm.seasons, months: calm.seasons.months.map(() => deg) },
});

function rebuild(w, content, wall, door) {
  const parts = content.buildings.parts;
  const at = (id) => parts.findIndex((p) => p.id === id) + 1;
  for (let i = 0; i < w.map.built.length; i += 1) {
    const kind = parts[w.map.built[i] - 1]?.kind;
    if (kind === 'wall') w.map.built[i] = at(wall);
    if (kind === 'door') w.map.built[i] = at(door);
  }
}

function cooling(seed) {
  const content = cold(-12);
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  step(w, sim, 10 * DAY);
  const fire = firesOf(w).find((f) => {
    const p = furnitureOf(w).find((q) => q.id === f.piece);
    return roomAt(w, content, p.x, p.y);
  });
  if (!fire) return [{ seed, walls: 'no room hearth yet' }];
  const piece = furnitureOf(w).find((q) => q.id === fire.piece);
  const rows = [];
  for (const [walls, wall, door] of [
    ['timber', 'wall-wood', 'door-wood'],
    ['clay daub', 'wall-daub', 'door-wood'],
    ['stone', 'wall-stone', 'door-stone'],
  ]) {
    rebuild(w, content, wall, door);
    Object.assign(fire, { lit: 1, banked: 0, kind: 'firewood', fuel: 999, air: 0 });
    for (let h = 0; h < 48; h += 1) airHour(w, content);
    const lit = airOf(fire);
    Object.assign(fire, { banked: 1, air: 0 });
    for (let h = 0; h < 48; h += 1) airHour(w, content);
    const banked = airOf(fire);
    Object.assign(fire, { banked: 0, air: lit * 10 });
    Object.assign(fire, { lit: 0, fuel: 0 });
    let h = 0;
    let under5 = 0;
    while (fire.air > 0 && h < 500) {
      airHour(w, content);
      h += 1;
      if (!under5 && airOf(fire) < 5) under5 = h;
    }
    rows.push({
      seed,
      walls,
      leakPerHour: `${leakOf(w, content, piece) / 10}%`,
      lit,
      banked,
      under5,
      cold: h,
    });
  }
  return rows;
}

function hearths(seed, setting) {
  const content = cold(-12);
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  step(w, sim, 10 * DAY);
  submitCommand(w, { tick: w.tick + 1, kind: 'setLaw', data: { law: 'hearths', setting } });
  const low = content.life.needs.find((n) => n.id === 'warmth').low;
  const counts = { 'fire.stoked': 0, 'law.keptCustom': 0, 'law.saw': 0, 'fire.banked': 0 };
  let burned = 0;
  let coldHours = 0;
  for (let h = 0; h < 14 * 24; h += 1) {
    for (const f of firesOf(w)) if (f.lit) burned += Math.min(f.fuel, f.banked ? 15 : 60);
    for (const line of step(w, sim, 60)) if (line.type in counts) counts[line.type] += 1;
    const people = w.entities.person.filter((p) => p.status === 'alive');
    coldHours += people.filter((p) => {
      const n = w.entities.need.find((r) => r.person === p.id && r.need === 'warmth');
      return n && n.value < low;
    }).length;
  }
  const answers = { obeys: 0, grumbles: 0, refuses: 0 };
  for (const a of w.entities.answer ?? []) if (a.law === 'hearths') answers[a.answer] += 1;
  const moods = w.entities.mood ?? [];
  const mood = Math.round(moods.reduce((n, m) => n + m.value, 0) / Math.max(1, moods.length));
  return {
    seed,
    setting,
    firewood: Math.round(burned / 60),
    coldHours,
    answers: `${answers.obeys}/${answers.grumbles}/${answers.refuses}`,
    banked: counts['fire.banked'],
    stoked: counts['fire.stoked'],
    oldWay: counts['law.keptCustom'],
    seen: counts['law.saw'],
    mood,
  };
}

for (const seed of seeds.length ? seeds : ['anvil', 'smoke', 'tallow']) {
  for (const row of cooling(seed)) console.log(JSON.stringify(row));
  for (const s of ['frugal', 'steady', 'roaring']) console.log(JSON.stringify(hearths(seed, s)));
}
