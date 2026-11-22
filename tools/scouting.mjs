// Known land and scouting (6W Slice 4, V-204): `node tools/scouting.mjs <days> <seed>` runs one
// seed with default levers and prints one JSON line: the share of the valley known by year, hours
// spent beyond 40 tiles, each scouting trip (need, hours, how far, what it told of), work done at
// finds, and any work target chosen on unknown ground (always 0, or a search reads unknown land).
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content } = engine;
const days = Number(process.argv[2] ?? 336);
const seed = process.argv[3] ?? 'anvil';
const YEAR = 336;
const sim = createSim(content);
const w = createWorld(sim, seed);
const m = w.map;
const [W, H] = [m.width, m.height];
const t0 = performance.now();
const store = () => {
  const s = (w.entities['store'] ?? [])[0];
  return s ? [s.x, s.y] : [m.startX, m.startY];
};
const cheb = (x, y, [ox, oy]) => Math.max(Math.abs(x - ox), Math.abs(y - oy));
const share = (a, v) => +(a.reduce((n, k) => n + (k === v ? 1 : 0), 0) / a.length).toFixed(3);
const walked = new Uint8Array(W * H);
let [hours, beyond40, unknownTargets] = [0, 0, 0];
const atFinds = new Set();
const trips = [];
const yearly = [];
for (let day = 0; day < days; day += 1) {
  for (let t = 0; t < 1440; t += 5) {
    for (const l of step(w, sim, 5) ?? []) {
      if (l.type === 'work.tookUpScouting') trips.push({ day, tick: l.tick, ...l.data });
      if (l.type === 'land.toldOf' || l.type === 'land.noWord') {
        const trip = trips.at(-1);
        Object.assign(trip, {
          end: l.type,
          hours: Math.round((l.tick - trip.tick) / 60),
          told: l.data,
        });
      }
    }
    const o = store();
    for (const p of w.entities.person) {
      if (p.status !== 'alive' || p.z > 0) continue;
      walked[p.y * W + p.x] = 1;
      const d = cheb(p.x, p.y, o);
      if (p.job === 'scout') trips.at(-1).far = Math.max(trips.at(-1).far ?? 0, d);
      if (t % 60 === 0) [hours, beyond40] = [hours + 1, beyond40 + (d > 40 ? 1 : 0)];
      if (!['fell', 'quarry', 'forage'].includes(p.job) || p.target < 0) continue;
      if (m.known[p.target] !== 1) unknownTargets += 1;
      if (cheb(p.target % W, Math.floor(p.target / W), o) > 40) atFinds.add(p.target);
    }
  }
  if ((day + 1) % YEAR === 0)
    yearly.push({ year: (day + 1) / YEAR, known: share(m.known, 1), walked: share(walked, 1) });
}
const alive = w.entities.person.filter((p) => p.status === 'alive').length;
const o = store();
const finds = m.finds.map((f) => ({ ...f, far: cheb(f.x, f.y, o) }));
console.log(
  JSON.stringify({
    seed,
    days,
    seconds: Math.round((performance.now() - t0) / 1000),
    yearly,
    beyond40: +(beyond40 / hours).toFixed(3),
    trips: trips.map(({ day, good, have, want, end, hours: h, far, told }) => ({
      day,
      good,
      have,
      want,
      end,
      hours: h,
      far,
      told,
    })),
    finds,
    workedAtFinds: atFinds.size,
    unknownTargets,
    alive,
    ever: w.entities.person.length,
  }),
);
