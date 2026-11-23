// `npm run timeuse` (time-use audit, 2026-11-23): what every colonist spends their time on over a
// run, as shares of their samples, to find behaviour bugs no test names (idling in work hours,
// walking more than working, jobs never taken, people stuck on one tile). Reads state only.
// Samples each living person every `every` minutes (default 10): their `doing`, their `job`, whether
// they are on a path, and whether the hour is inside their own work hours (law `hoursOf`).
// `npm run timeuse -- anvil 10 tmp/timeuse-anvil.json [every]`; one seed a process, seeds in
// parallel shells. Ten years on the 250-tile valley take about as long as `npm run decade`.
import { writeFileSync } from 'node:fs';
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content, grown, hoursOf, clockAt, lineOf, needOf, isDark } =
  engine;
const [seed = 'anvil', yearsArg = '10', out = `tmp/timeuse-${seed}.json`, everyArg = '10'] =
  process.argv.slice(2);
const years = Number(yearsArg);
const every = Number(everyArg);
const DAY = 1440;
const YEAR_DAYS = content.calendar.daysPerMonth * content.calendar.monthsPerYear;
const SEASONS = content.calendar.seasons;
/** Awake states that count as stuck when they last this long on one tile (minutes). */
const STUCK = 6 * 60;
const RESTING = new Set(['sleep', 'hurt', 'stocks', 'held']);

const sim = createSim(content);
const w = createWorld(sim, seed);

/** What one sample is: the activity, and whether the person is walking to it. */
const activity = (p) => {
  const doing = p.doing || '';
  const job = p.job || '';
  if (doing === 'work') return `work:${job || 'none'}`;
  if (doing === 'relax' && job) return `relax:${job}`;
  if (doing === '') return job ? `free:${job}` : 'idle';
  return doing;
};
const walking = (p) => Array.isArray(p.path) && p.path.length > 0;
const inHours = (p, hour) => {
  const h = hoursOf(w, content, p.id);
  return hour >= h.workFrom && hour < h.workTo;
};

const bump = (o, k, n = 1) => {
  o[k] = (o[k] ?? 0) + n;
};
// Tallies: by year and season for adults and children; per person for the whole run; work-hours.
const bySeason = {}; // `${year}:${season}:${adult|child}` -> { activity: samples }
const walk = {}; // same key -> { activity: samples spent walking }
const hours = {}; // `${year}:${adult|child}` -> { activity: samples inside own work hours }
const why = {}; // `${year}:${season}` -> { reason: adult idle samples inside own work hours }
const people = new Map(); // id -> { name, trade, race, samples, acts, walk, stuck }
const still = new Map(); // id -> { key, since }
const stuckRuns = []; // { name, year, day, hour, minutes, what, x, y, z }

const ctx = { world: w, content, hooks: sim.hooks };
/** Why an idle adult in their own work hours took nothing up (people jobs.ts `freeForNew`, `takeUp`):
 * recreation under its seek line, waiting after finding no work, or dark on the surface. */
const idleWhy = (p) => {
  const fun = needOf(w, p.id, 'recreation');
  if (fun && fun.value < lineOf(ctx, p, 'recreation')) return 'bored';
  if (isDark(content, w.tick) && p.z === 0) return 'dark';
  if (w.tick < p.next) return 'no work found';
  return 'other';
};

/** The run-wide tallies for one sample of one person. */
const tally = (p, c, season, age, act, moving) => {
  const key = `${c.year}:${season}:${age}`;
  bump((bySeason[key] ??= {}), act);
  if (moving) bump((walk[key] ??= {}), act);
  if (!inHours(p, c.hour)) return;
  bump((hours[`${c.year}:${age}`] ??= {}), act);
  if (age === 'adult' && act === 'idle') bump((why[`${c.year}:${season}`] ??= {}), idleWhy(p));
};

/** The person's own row: their samples, activities and walking over the run. */
const personRow = (p, c, age, act, moving) => {
  let row = people.get(p.id);
  if (!row) {
    row = { name: p.name, trade: p.trade, race: p.race, samples: 0, acts: {}, walk: 0 };
    row.firstYear = c.year;
    people.set(p.id, row);
  }
  row.samples += 1;
  row.lastYear = c.year;
  row.adult = age === 'adult';
  bump(row.acts, act);
  if (moving) row.walk += 1;
};

/** Stuck: awake, not walking, same tile and same activity for STUCK minutes or more. */
const watchStill = (p, c, act, moving) => {
  const here = `${p.x},${p.y},${p.z}|${act}`;
  const s = still.get(p.id);
  const resting = moving || RESTING.has(p.doing);
  if (!resting && s && s.key === here) return;
  if (s && s.key !== here && w.tick - s.since >= STUCK && !s.resting)
    stuckRuns.push({ ...s.info, minutes: w.tick - s.since });
  const day = (Math.floor(w.tick / DAY) % YEAR_DAYS) + 1;
  const info = { name: p.name, year: c.year, day, hour: c.hour, what: act, x: p.x, y: p.y, z: p.z };
  still.set(p.id, { key: here, since: w.tick, resting, info });
};

const sample = () => {
  const c = clockAt(w.tick, content.calendar);
  const season = SEASONS[c.season];
  for (const p of w.entities.person) {
    if (p.status !== 'alive') continue;
    const age = grown(w, content, p) ? 'adult' : 'child';
    const act = activity(p);
    const moving = walking(p);
    tally(p, c, season, age, act, moving);
    personRow(p, c, age, act, moving);
    watchStill(p, c, act, moving);
  }
};

const t0 = Date.now();
const alive = [];
const save = () =>
  writeFileSync(
    out,
    JSON.stringify(
      {
        seed,
        years,
        every,
        alive,
        bySeason,
        walk,
        hours,
        why,
        people: [...people.entries()].map(([id, r]) => ({ id, ...r })),
        stuck: stuckRuns.sort((a, b) => b.minutes - a.minutes).slice(0, 300),
        stuckCount: stuckRuns.length,
      },
      null,
      1,
    ),
  );
// Whole calendar years from the start: the run stops when the clock turns past the last one.
const yearNow = () => clockAt(w.tick, content.calendar).year;
const first = yearNow();
for (let y = 0; y < years; y += 1) {
  while (yearNow() <= first + y) {
    step(w, sim, every);
    if (yearNow() <= first + y) sample();
  }
  const living = w.entities.person.filter((p) => p.status === 'alive');
  alive.push({
    year: y + 1,
    alive: living.length,
    adults: living.filter((p) => grown(w, content, p)).length,
  });
  save();
  console.log(
    `${seed} y${y + 1} alive ${living.length} (${Math.round((Date.now() - t0) / 1000)} s)`,
  );
}
save();
