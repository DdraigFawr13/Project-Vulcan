// `npm run map:stats` (or `map:render`): lays out the surface for every seed in the map seed list and
// prints one table (climate, biome shares, rock, trees, water, start counts, generation time) against
// the P1.1 and P1.2 done-whens, then makes the four levels below and prints a second table against
// P1.3's, then runs a year of weather on each (P1.4, tools/map-weather.mjs). With --render,
// writes one PNG per seed and level to tmp/maps/ (not committed).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { createSim, createWorld } from '../src/engine/index.ts';
import { strandedWater, waterNearStart } from '../src/engine/map/checks.ts';
import { reachableAround } from '../src/engine/map/features.ts';
import { MAP_SEEDS } from '../src/engine/map/seeds.ts';
import { makeLevel } from '../src/engine/map/underground.ts';
import { WEATHER_HEAD, weatherRow } from './map-weather.mjs';

const json = (name) => JSON.parse(readFileSync(path.join(root, 'src/content/data', name), 'utf8'));
const content = {
  calendar: json('calendar.json'),
  events: json('events.json'),
  terrain: json('terrain.json'),
  biomes: json('biomes.json'),
  features: json('features.json'),
  weather: json('weather.json'),
  seasons: json('seasons.json'),
  schools: json('schools.json'),
};
const render = process.argv.includes('--render');
const sim = createSim(content);
const need = content.terrain.generator.start;
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const rows = [];
const below = [];
let failures = 0;
let levelFailures = 0;
let weatherFailures = 0;
const years = [];
const ORE_COLOUR = {
  copper: [60, 170, 130],
  tin: [215, 220, 230],
  iron: [170, 60, 40],
  sulphur: [230, 210, 60],
  gold: [250, 190, 40],
  silver: [190, 200, 220],
  gems: [170, 70, 200],
  obsidian: [10, 10, 16],
};
const UNDER_COLOUR = {
  'rock-wall': [96, 92, 90],
  slate: [58, 64, 76],
  limestone: [160, 154, 138],
  sandstone: [138, 92, 66],
  earth: [92, 70, 48],
  clay: [150, 96, 62],
  groundwater: [60, 100, 140],
  'cave-floor': [28, 26, 26],
};

for (const seed of MAP_SEEDS) {
  const t = performance.now();
  const world = createWorld(sim, seed);
  const ms = performance.now() - t;
  const m = world.map;
  const n = m.width * m.height;
  const counts = new Map();
  for (const b of m.biomes) counts.set(b, (counts.get(b) ?? 0) + 1);
  const top = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([b, c]) => `${content.biomes.biomes[b].name.toLowerCase()} ${pct(c, n)}`)
    .join(', ');
  const rock = m.tiles.filter((t) => content.terrain.kinds[t].stone).length;
  const kindOf = (f) => (f > 0 ? content.features[f - 1].kind : '');
  const trees = m.features.filter((f) => kindOf(f) === 'tree').length;
  const c = reachableAround(
    content,
    m.tiles,
    m.features,
    m.width,
    m.height,
    need.radius,
  )(m.startX, m.startY);
  const water = m.water.filter((w) => w > 0).length;
  const { lakes, springs } = world.log.find((e) => e.type === 'map.watered').data;
  const drink = waterNearStart(content, m, need.radius);
  const stranded = strandedWater(m);
  const ok =
    c.buildable >= need.buildable &&
    c.wood >= need.wood &&
    c.stone >= need.stone &&
    drink > 0 &&
    stranded === 0 &&
    water >= 0.06 * n &&
    water <= 0.14 * n &&
    ms <= 300;
  if (!ok) failures += 1;
  const meanFert = Math.round(
    m.fertility.reduce((s, v, i) => s + (content.terrain.kinds[m.tiles[i]].buildable ? v : 0), 0) /
      n,
  );
  rows.push(
    `| ${seed} | ${m.climate} ${m.temperature} °C ${m.rainfall} mm | ${top} | ${pct(rock, n)} | ${pct(trees, n)} | ${pct(water, n)} | ${lakes} / ${springs} | ${meanFert} | ${m.startX},${m.startY} | ${c.buildable} / ${c.wood} / ${c.stone} / ${drink} | ${stranded} | ${ok ? 'yes' : 'NO'} | ${ms.toFixed(0)} |`,
  );
  if (render) drawMap(seed, m);
  below.push(levelRow(seed, m));
  const year = weatherRow(sim, seed, world, render);
  if (!year.ok) weatherFailures += 1;
  years.push(year.row);
}
process.stdout.write(
  `| seed | climate | main biomes | rock | trees | water | lakes / springs | fertility | start | build / wood / stone / water within ${need.radius} | inland ends | done | ms |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`,
);
process.stdout.write(
  `${MAP_SEEDS.length - failures} of ${MAP_SEEDS.length} seeds meet the done-whens (${need.buildable} buildable, ${need.wood} trees, ${need.stone} stone and drinkable water near the start; no inland ends; water 6 to 14% of the map; under 300 ms).\n`,
);
process.stdout.write(
  `\n| seed | bedrock on level 2 | caves % by level | nearest copper / tin (level 2) | nearest iron (3) | ore tiles copper / tin / iron / gold | slowest level ms | done |\n|---|---|---|---|---|---|---|---|\n${below.join('\n')}\n`,
);
process.stdout.write(
  `${MAP_SEEDS.length - levelFailures} of ${MAP_SEEDS.length} seeds meet P1.3's done-when (copper and tin within ${need.radius} tiles of the start on level 2; each level under 300 ms).\n`,
);
process.stdout.write(`\n${WEATHER_HEAD}\n${years.join('\n')}\n`);
process.stdout.write(
  `${MAP_SEEDS.length - weatherFailures} of ${MAP_SEEDS.length} seeds meet P1.4's done-when (a year of weather freezes still water).\n`,
);
if (failures + levelFailures + weatherFailures > 0) process.exitCode = 1;

function drawMap(seed, m) {
  const S = 3;
  const image = createImage(m.width * S, m.height * S);
  const kindColour = {
    'rock-wall': [104, 98, 96],
    slate: [62, 68, 80],
    limestone: [176, 170, 152],
    sandstone: [150, 98, 70],
    snowcap: [225, 228, 232],
    gravel: [140, 134, 124],
    snow: [235, 238, 240],
    sand: [214, 196, 140],
    marsh: [96, 112, 74],
    'water-shallow': [86, 140, 190],
    'water-deep': [38, 78, 140],
    spring: [170, 230, 255],
  };
  const featureColour = {
    tree: [28, 64, 30],
    bush: [150, 40, 70],
    herb: [210, 200, 70],
    boulder: [60, 58, 56],
    log: [90, 60, 30],
  };
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const i = y * m.width + x;
      const kind = m.snow[i] ? 'snowcap' : content.terrain.kinds[m.tiles[i]].id;
      const biome = content.biomes.biomes[m.biomes[i]];
      // Shade by height so the valley's shape shows.
      const shade = m.water[i] ? 1 : 0.75 + 0.35 * ((m.elevation[i] % 400) / 400 < 0.5 ? 0 : 0.15);
      const base = (kindColour[kind] ?? biome.color).map((v) => Math.min(255, v * shade));
      for (let dy = 0; dy < S; dy++)
        for (let dx = 0; dx < S; dx++)
          image.data.set([...base, 255], ((y * S + dy) * image.width + x * S + dx) * 4);
      const f = m.features[i];
      if (f > 0) {
        const colour = featureColour[content.features[f - 1].kind];
        image.data.set([...colour, 255], ((y * S + 1) * image.width + x * S + 1) * 4);
      }
    }
  for (let d = -4; d <= 4; d++)
    for (const [x, y] of [
      [m.startX * S + 1 + d, m.startY * S + 1],
      [m.startX * S + 1, m.startY * S + 1 + d],
    ])
      image.data.set([255, 40, 40, 255], (y * image.width + x) * 4);
  const dir = path.join(root, 'tmp/maps');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${seed}.png`), encodePng(image));
}

// Makes every level below straight from the seed (as reaching them would) and reads P1.3's numbers.
function levelRow(seed, m) {
  const { depth } = content.terrain.generator.underground;
  const n = m.width * m.height;
  const near = {};
  const ore = {};
  const caves = [];
  let slowest = 0;
  let bedrock = '';
  for (let z = 1; z <= depth; z++) {
    const t = performance.now();
    const level = makeLevel(seed, content, m, z);
    slowest = Math.max(slowest, performance.now() - t);
    const kinds = level.tiles.reduce((c, k) => c.set(k, (c.get(k) ?? 0) + 1), new Map());
    const cave = content.terrain.kinds.findIndex((k) => k.id === 'cave-floor');
    caves.push(Math.round((100 * (kinds.get(cave) ?? 0)) / n));
    if (z === 2)
      bedrock = [...kinds]
        .filter(([k]) => content.terrain.kinds[k].stone)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, c]) => `${content.terrain.kinds[k].name} ${pct(c, n)}`)
        .join(', ');
    level.features.forEach((f, i) => {
      if (!f) return;
      const id = content.features[f - 1].id;
      ore[id] = (ore[id] ?? 0) + 1;
      const x = i % m.width;
      const d = Math.max(Math.abs(x - m.startX), Math.abs((i - x) / m.width - m.startY));
      near[id] = Math.min(near[id] ?? Infinity, d);
    });
    if (render) drawLevel(seed, m, z, level);
  }
  const ok = near.copper <= need.radius && near.tin <= need.radius && slowest <= 300;
  if (!ok) levelFailures += 1;
  return `| ${seed} | ${bedrock} | ${caves.join(' / ')} | ${near.copper} / ${near.tin} | ${near.iron} | ${ore.copper} / ${ore.tin} / ${ore.iron} / ${ore.gold} | ${slowest.toFixed(0)} | ${ok ? 'yes' : 'NO'} |`;
}

function drawLevel(seed, m, z, level) {
  const S = 3;
  const image = createImage(m.width * S, m.height * S);
  for (let i = 0; i < m.width * m.height; i++) {
    const x = i % m.width;
    const y = (i - x) / m.width;
    const f = level.features[i];
    const colour = f
      ? ORE_COLOUR[content.features[f - 1].id]
      : UNDER_COLOUR[content.terrain.kinds[level.tiles[i]].id];
    for (let dy = 0; dy < S; dy++)
      for (let dx = 0; dx < S; dx++)
        image.data.set([...colour, 255], ((y * S + dy) * image.width + x * S + dx) * 4);
  }
  const dir = path.join(root, 'tmp/maps');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${seed}-${z}.png`), encodePng(image));
}
