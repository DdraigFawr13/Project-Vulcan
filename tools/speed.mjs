// `npm run speed` (engine speed pass, 2026-11-25): how long a game day takes to simulate on one seed,
// and a digest of the whole world (ledger included) at the end, so a speed change can show it
// changed nothing: run it on main and on the branch and compare the digests. `npm run speed -- anvil 30`; options `--from <file>` starts from a world
// saved by `--save <file>`, `--profile <out.cpuprofile>` profiles only the timed days. One
// seed a process, seeds in parallel shells.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialize, serialize } from 'node:v8';
import { Session } from 'node:inspector/promises';
import { engine } from './engine.mjs';

const { createSim, createWorld, step, content } = engine;
const args = process.argv.slice(2);
const opt = (name) => {
  const at = args.indexOf(name);
  return at < 0 ? undefined : args.splice(at, 2)[1];
};
const from = opt('--from');
const save = opt('--save');
const profile = opt('--profile');
const [seed = 'anvil', daysArg = '30'] = args;
const days = Number(daysArg);
const sim = createSim(content);
const w = from ? deserialize(readFileSync(from)) : createWorld(sim, seed);
const session = profile ? new Session() : undefined;
if (session) {
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.start');
}
const t0 = performance.now();
for (let d = 0; d < days; d += 1) for (let h = 0; h < 24; h += 1) step(w, sim, 60);
const ms = performance.now() - t0;
if (session) {
  const { profile: p } = await session.post('Profiler.stop');
  writeFileSync(profile, JSON.stringify(p));
}
const text = JSON.stringify(w);
if (save) writeFileSync(save, serialize(w));
const digest = createHash('sha256').update(text).digest('hex').slice(0, 16);
const alive = w.entities.person.filter((p) => p.status === 'alive').length;
console.log(
  JSON.stringify({
    seed,
    days,
    ms: Math.round(ms),
    msPerDay: Math.round(ms / days),
    alive,
    digest,
  }),
);
