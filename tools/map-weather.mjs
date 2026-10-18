// `npm run map:stats` part three (P1.4): runs a year of weather on a seed's world and reads it
// against the done-when (winter freezes still water). With --render, overlays the seed's most
// frozen day and its aura spots on the surface PNG as tmp/maps/<seed>-winter.png.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { decodePng, encodePng } from './png.mjs';
import { engine } from './engine.mjs';

const { isFrozen, step, TICKS_PER_DAY, WATER } = engine;

const LAKE = WATER.indexOf('lake');
/** A tarn: a lake this many metres above the valley floor, where it is about 2 °C colder or more. */
const TARN = 300;
const GLOW = {
  air: [255, 236, 120],
  water: [60, 200, 255],
  life: [90, 230, 100],
  mind: [210, 120, 255],
  earth: [230, 170, 60],
  fire: [255, 90, 40],
};

export const WEATHER_HEAD =
  '| seed | coldest / hottest day °C | frost days | weather lines | valley ice days | valley most ice | tarn ice days | aura spots (surface) | done |\n|---|---|---|---|---|---|---|---|---|';

/** One year (336 days) on `world`; returns its table row and whether it meets the done-when. */
export function weatherRow(sim, seed, world, render) {
  const m = world.map;
  const lakes = [];
  for (let i = 0; i < m.water.length; i++) if (m.water[i] === LAKE) lakes.push(i);
  const tarn = (i) => m.elevation[i] > m.floor + TARN;
  const valley = lakes.filter((i) => !tarn(i));
  let min = Infinity;
  let max = -Infinity;
  let frost = 0;
  let valleyDays = 0;
  let tarnDays = 0;
  let most = 0;
  let best = { frozen: -1, ice: m.ice };
  const before = world.log.length;
  for (let day = 0; day < 336; day++) {
    step(world, sim, TICKS_PER_DAY);
    const t = world.systems.weather.temp;
    min = Math.min(min, t);
    max = Math.max(max, t);
    if (t < 0) frost++;
    const v = valley.filter((i) => isFrozen(m, i)).length;
    const k =
      lakes.length - valley.length ? lakes.filter((i) => tarn(i) && isFrozen(m, i)).length : 0;
    if (v) valleyDays++;
    if (k) tarnDays++;
    most = Math.max(most, valley.length ? v / valley.length : 0);
    if (v + k >= best.frozen) best = { frozen: v + k, ice: m.ice.slice() };
  }
  const lines = world.log.slice(before).filter((e) => e.type === 'weather.changed').length;
  const ok = valleyDays + tarnDays > 0;
  const spots = m.auraSpots.map((s) => `${s.school} ${s.strength}`).join(', ');
  if (render) drawWinter(seed, m, best.ice);
  return {
    ok,
    row: `| ${seed} | ${min} / ${max} | ${frost} | ${lines} | ${valleyDays} | ${Math.round(100 * most)}% | ${lakes.length > valley.length ? tarnDays : '–'} | ${spots} | ${ok ? 'yes' : 'NO'} |`,
  };
}

function drawWinter(seed, m, ice) {
  const dir = path.join(root, 'tmp/maps');
  const image = decodePng(readFileSync(path.join(dir, `${seed}.png`)));
  const S = image.width / m.width;
  const paint = (x, y, colour, a) => {
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) return;
    for (let dy = 0; dy < S; dy++)
      for (let dx = 0; dx < S; dx++) {
        const p = ((y * S + dy) * image.width + x * S + dx) * 4;
        for (let c = 0; c < 3; c++)
          image.data[p + c] = Math.round(image.data[p + c] * (1 - a) + colour[c] * a);
      }
  };
  for (let i = 0; i < ice.length; i++)
    if (ice[i] & 0x80) paint(i % m.width, Math.floor(i / m.width), [226, 240, 248], 1);
  for (const s of m.auraSpots.filter((s) => s.z === 0))
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if (dx * dx + dy * dy <= 25)
          paint(s.x + dx, s.y + dy, GLOW[s.school], 0.75 - (dx * dx + dy * dy) / 40);
  writeFileSync(path.join(dir, `${seed}-winter.png`), encodePng(image));
}
