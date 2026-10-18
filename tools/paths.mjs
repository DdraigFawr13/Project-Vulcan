// `npm run paths` (P2.3 done-when): on three map seeds, opens levels 1 to 4 under the camp with a
// shaft, then sends five walkers to 40 goals each, on the surface and below, and times every
// search; then runs a game day of the band walking and times the people system per tick. Prints
// one table against the budget: a search, and a tick with five walkers, under the 5 ms tick budget.
import { engine } from './engine.mjs';

const {
  createSim,
  createWorld,
  step,
  submitCommand,
  findPath,
  walkAt,
  TICKS_PER_DAY,
  MAP_SEEDS,
  content,
} = engine;
const sim = createSim(content);
const pct = (xs, p) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const ms = (v) => v.toFixed(2);
console.log(
  '| seed | regions ms | searches | found | mean ms | p95 ms | max ms | day: people ms/tick mean | max |',
);
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const seed of MAP_SEEDS.slice(0, 3)) {
  const world = createWorld(sim, seed);
  const { map } = world;
  const at = { x: map.startX + 1, y: map.startY };
  submitCommand(world, { tick: world.tick + 1, kind: 'sinkShaft', data: { ...at, z: 0, to: 4 } });
  step(world, sim, 1);
  // A fixed spread of goals: every 37th open tile of each level, in turn.
  const goals = [];
  for (let z = 0; z <= 4; z += 1)
    for (let i = 0; i < map.width * map.height; i += 37)
      if (walkAt(content, map, z, i))
        goals.push({ x: i % map.width, y: Math.floor(i / map.width), z });
  // The first search works out every level's regions; it is timed on its own.
  let t0 = performance.now();
  findPath(content, map, { x: map.startX, y: map.startY, z: 0 }, { ...at, z: 4 });
  const build = performance.now() - t0;
  const times = [];
  let found = 0;
  const walkers = Array.from({ length: 5 }, (_, k) => ({
    x: map.startX + k - 2,
    y: map.startY,
    z: 0,
  }));
  for (let round = 0; round < 40; round += 1)
    walkers.forEach((w, k) => {
      const goal = goals[(round * 131 + k * 977) % goals.length];
      const t = performance.now();
      const path = findPath(content, map, w, goal);
      times.push(performance.now() - t);
      if (path) {
        found += 1;
        Object.assign(w, goal);
      }
    });
  // A day of the band walking: the people system's time per tick.
  const people = sim.systems.find((s) => s.id === 'people');
  const run = people.run;
  const ticks = [];
  people.run = (ctx) => {
    const t = performance.now();
    run(ctx);
    ticks.push(performance.now() - t);
  };
  step(world, sim, TICKS_PER_DAY);
  people.run = run;
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(
    `| ${seed} | ${ms(build)} | ${times.length} | ${found} | ${ms(mean(times))} | ${ms(pct(times, 0.95))} | ${ms(Math.max(...times))} | ${ms(mean(ticks))} | ${ms(Math.max(...ticks))} |`,
  );
}
