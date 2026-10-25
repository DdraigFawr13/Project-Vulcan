// `npm run balance:5a` (the 5A balance pass, PHASE_5.md): two game years on each seed with the
// default levers, and one table against 5A's done-when: most seeds keep their people through two
// winters with the pack about. Reads state only. One seed a process, about 1.5 min a seed
// (measured 2026-10-25); seeds: `npm run balance:5a -- anvil smoke`. Not part of any check.
import { engine } from './engine.mjs';

const {
  createSim,
  createWorld,
  submitCommand,
  flocksOf,
  hallOf,
  headOf,
  homeFor,
  step,
  content,
  TICKS_PER_DAY,
} = engine;
// Valley seeds (`region/n`): a plain seed has no neighbours, so no strangers ever come.
// `--open`: the Strangers law set to Open door on the first day (default Those in need).
const open = process.argv.includes('--open');
const args = process.argv.slice(2).filter((a) => a !== '--open');
const seeds = args.length ? args : ['anvil/1', 'smoke/2', 'tallow/3', 'ledger/1'];
const YEAR = 336;
const COUNT = [
  'health.died',
  'health.carried',
  'health.buried',
  'wild.attacked',
  'wild.predatorKilled',
  'wild.killed',
  'wild.packAtEdge',
  'people.strangerCame',
  'people.strangerStays',
  'people.strangerTurnedAway',
  'build.homeSited',
  'build.hall',
  'flock.tamed',
  'flock.lambed',
  'flock.butchered',
  'flock.taken',
  'flock.starved',
  'build.roadLaid',
];
for (const seed of seeds) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  if (open)
    submitCommand(w, { tick: 1, kind: 'setLaw', data: { law: 'strangers', setting: 'open' } });
  const n = Object.fromEntries(COUNT.map((k) => [k, 0]));
  const deaths = [];
  const winters = [];
  let hungry = 0;
  for (let day = 0; day < 2 * YEAR; day += 1) {
    for (const line of step(w, sim, TICKS_PER_DAY)) {
      if (line.type in n) n[line.type] += 1;
      if (line.type === 'health.died')
        deaths.push(
          `day ${day + 1} ${line.data.name ?? ''}: ${line.data.cause ?? line.data.what ?? ''}`,
        );
      if (line.type === 'need.low' && line.data.word === 'hungry') hungry += 1;
    }
    // The end of each winter: the last day of the year.
    if ((day + 1) % YEAR === 0)
      winters.push(w.entities.person.filter((p) => p.status === 'alive').length);
  }
  const alive = w.entities.person.filter((p) => p.status === 'alive');
  const unhoused = alive.filter((p) => homeFor(w, p.id)?.state !== 'built').length;
  const flock = flocksOf(w).reduce((k, f) => k + headOf(w, f), 0);
  const hall = hallOf(w) ? 'yes' : 'no';
  process.stdout.write(
    `${JSON.stringify({ seed, law: open ? 'open' : 'need', winters, alive: alive.length, unhoused, hall, hungry, flock, ...n, deaths })}\n`,
  );
}
