// `npm run budget` (P2.0 done-when): a synthetic colony of 30 people run for ten game years on a
// real valley, to show the ledger and saves stay within their budgets (DECISIONS V-027, V-036).
// Each person writes 15 lines a game day, each citing their previous one, and remembers their
// latest 40 lines; 3,000 items each cite the line that made them, one remade a day; six tiles a
// day change, each citing a line. Sealed days are taken each midnight as the worker takes them.
// Prints one row per year and fails on a miss. Takes a few minutes (measured below); it is not
// part of `npm run check` or CI (RULES VR-25).
import { serialize } from 'node:v8';
import { gzipSync } from 'node:zlib';
import { engine } from './engine.mjs';

const { addEntity, createSim, createWorld, removeEntity, step, submitCommand, SYSTEMS } = engine;
const { TICKS_PER_DAY } = engine;

const PEOPLE = 30;
const LINES_PER_DAY = 15;
const MEMORY = 40;
const ITEMS = 3000;
const TILES_PER_DAY = 6;
const YEARS = 10;
const BUDGET = { ledgerMB: 2, saveMB: 4, cloneMs: 25, archiveMB: 40, sealMs: 5 };

// The game's own content, with the stand-in colony's two line types added.
const content = { ...engine.content };
content.events = [
  ...content.events,
  { id: 'budget.did', template: '{actor0} did task {n}.' },
  { id: 'budget.made', template: '{actor0} made item {n}.' },
];

const perHour = (hour) =>
  Math.floor(((hour + 1) * PEOPLE * LINES_PER_DAY) / 24) -
  Math.floor((hour * PEOPLE * LINES_PER_DAY) / 24);

const colony = {
  id: 'budget-colony',
  every: 'hour',
  emits: ['budget.did', 'budget.made'],
  tables: {
    budgetPerson: { name: 'text', last: 'event', memory: 'events' },
    budgetItem: { kind: 'count', holder: 'entity', made: 'event' },
  },
  initialState: { turn: 0 },
  init(ctx) {
    const people = [];
    for (let p = 0; p < PEOPLE; p += 1)
      people.push(addEntity(ctx.world, 'budgetPerson', { name: `P${p}`, last: 0, memory: [] }));
    for (let i = 0; i < ITEMS; i += 1)
      addEntity(ctx.world, 'budgetItem', { kind: i % 40, holder: people[i % PEOPLE], made: 1 });
  },
  run(ctx) {
    const { world, state } = ctx;
    const people = world.entities.budgetPerson;
    const hour = (world.tick / 60) % 24;
    for (let k = 0; k < perHour(hour); k += 1) {
      const who = people[state.turn % PEOPLE];
      state.turn += 1;
      const id = ctx.emit('budget.did', {
        actors: [who.id],
        causes: who.last ? [who.last] : [],
        data: { n: state.turn },
      });
      who.last = id;
      who.memory.push(id);
      if (who.memory.length > MEMORY) who.memory.shift();
    }
    if (hour !== 12) return;
    // Midday: one item is used up and another made; six tiles change.
    const items = world.entities.budgetItem;
    removeEntity(world, 'budgetItem', items[0].id);
    const maker = people[state.turn % PEOPLE];
    const made = ctx.emit('budget.made', { actors: [maker.id], data: { n: state.turn } });
    addEntity(world, 'budgetItem', { kind: state.turn % 40, holder: maker.id, made });
    const tiles = world.map.tileCauses;
    for (let t = 0; t < TILES_PER_DAY; t += 1)
      tiles[(state.turn * 7919 + t * 104729) % tiles.length] = made;
  },
};

const sim = createSim(content, [...SYSTEMS, colony]);
const started = performance.now();
const world = createWorld(sim, 'budget/1');
// All four levels below reached, so the seal scans every level's tile causes as a mine would.
const { startX: x, startY: y } = world.map;
for (let z = 0; z < 4; z += 1)
  submitCommand(world, { tick: world.tick + 1 + z, kind: 'cutStairs', data: { x, y, z } });
// Run to the first midnight, so each day below ends on the midnight tick, timed on its own.
step(world, sim, TICKS_PER_DAY - (world.tick % TICKS_PER_DAY));
let archive = 0;
let sealMs = 0;
let sealMax = 0;
let seals = 0;
const rows = [];
let failed = false;
const mb = (bytes) => bytes / 1048576;
for (let year = 1; year <= YEARS; year += 1) {
  for (let day = 0; day < 336; day += 1) {
    step(world, sim, TICKS_PER_DAY - 1);
    const at = performance.now();
    step(world, sim, 1); // midnight: the seal runs in this tick
    const ms = performance.now() - at;
    sealMs += ms;
    sealMax = Math.max(sealMax, ms);
    seals += 1;
    for (const s of world.sealed) archive += gzipSync(s.text).length;
    world.sealed = [];
  }
  const ledger = mb(
    serialize({ log: world.log, stubs: world.stubs, segments: world.segments }).length,
  );
  const save = mb(serialize(world).length);
  // The standby copy's cost: the median of five structured clones (one is noisy).
  const clones = [];
  for (let k = 0; k < 5; k += 1) {
    const at = performance.now();
    structuredClone(world);
    clones.push(performance.now() - at);
  }
  const clone = clones.sort((a, b) => a - b)[2];
  const row = {
    year,
    written: world.nextEventId - 1,
    recent: world.log.length,
    stubs: world.stubs.length,
    ledger,
    save,
    clone,
    archive: mb(archive),
    seal: sealMs / seals,
    sealMax,
  };
  rows.push(row);
  const over =
    ledger > BUDGET.ledgerMB ||
    save > BUDGET.saveMB ||
    clone > BUDGET.cloneMs ||
    row.archive > BUDGET.archiveMB ||
    row.seal > BUDGET.sealMs;
  if (over) failed = true;
}
const f = (n, d = 2) => n.toFixed(d);
console.log(`Levels reached: ${world.map.levels.filter(Boolean).length} of 4.`);
console.log(
  `| Year | Lines written | Recent | Stubs | Ledger MB (≤${BUDGET.ledgerMB}) | Save MB (≤${BUDGET.saveMB}) | Clone ms (≤${BUDGET.cloneMs}) | Archive MB gz (≤${BUDGET.archiveMB}) | Midnight tick ms mean (≤${BUDGET.sealMs}) / max |`,
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows)
  console.log(
    `| ${r.year} | ${r.written.toLocaleString('en')} | ${r.recent} | ${r.stubs} | ${f(r.ledger)} | ${f(r.save)} | ${f(r.clone, 1)} | ${f(r.archive, 1)} | ${f(r.seal)} / ${f(r.sealMax, 1)} |`,
  );
console.log(`\nRun time ${f((performance.now() - started) / 1000, 1)} s.`);
if (failed) {
  console.log('OVER BUDGET: a row misses a budget above.');
  process.exit(1);
}
