// `npm run map:stats` (or `map:render`): lays out the surface for every seed in the map seed list and
// prints one table (climate, biome shares, rock, trees, start counts, generation time) against
// the P1.1 done-when. With --render, writes one PNG per seed to tmp/maps/ (not committed).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { createSim, createWorld } from '../src/engine/index.ts';
import { reachableAround } from '../src/engine/map/features.ts';
import { MAP_SEEDS } from '../src/engine/map/seeds.ts';

const json = (name) => JSON.parse(readFileSync(path.join(root, 'src/content/data', name), 'utf8'));
const content = {
  calendar: json('calendar.json'),
  events: json('events.json'),
  terrain: json('terrain.json'),
  biomes: json('biomes.json'),
  features: json('features.json'),
};
const render = process.argv.includes('--render');
const sim = createSim(content);
const need = content.terrain.generator.start;
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const rows = [];
let failures = 0;
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
  const ok = c.buildable >= need.buildable && c.wood >= need.wood && c.stone >= need.stone;
  if (!ok) failures += 1;
  const meanFert = Math.round(
    m.fertility.reduce((s, v, i) => s + (content.terrain.kinds[m.tiles[i]].buildable ? v : 0), 0) /
      n,
  );
  rows.push(
    `| ${seed} | ${m.climate} ${m.temperature} °C ${m.rainfall} mm | ${top} | ${pct(rock, n)} | ${pct(trees, n)} | ${meanFert} | ${m.startX},${m.startY} | ${c.buildable} / ${c.wood} / ${c.stone} | ${ok ? 'yes' : 'NO'} | ${ms.toFixed(0)} |`,
  );
  if (render) drawMap(seed, m);
}
process.stdout.write(
  `| seed | climate | main biomes | rock | trees | fertility | start | build / wood / stone within ${need.radius} | done | ms |\n|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`,
);
process.stdout.write(
  `${MAP_SEEDS.length - failures} of ${MAP_SEEDS.length} seeds meet the start rule (${need.buildable} buildable, ${need.wood} trees, ${need.stone} stone).\n`,
);
if (failures > 0) process.exitCode = 1;

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
      const shade = 0.75 + 0.35 * ((m.elevation[i] % 400) / 400 < 0.5 ? 0 : 0.15);
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
