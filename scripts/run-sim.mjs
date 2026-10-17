// Headless run: `npm run run-sim -- --seed vulcan --days 5`. Prints one line per day (stock,
// average needs, event counts) and the last few chronicle lines. A tool, not a gate.

import { parseArgs } from 'node:util';
import { defaultContent as content } from '../src/content/index.ts';
import { clockAt, createWorld, renderEvent, step } from '../src/engine/index.ts';

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: 'vulcan' },
    days: { type: 'string', default: '5' },
    lines: { type: 'string', default: '20' },
  },
});
const { world, events } = createWorld(values.seed, content);
const log = [...events];
const perDay = content.tuning.ticksPerDay;
const started = performance.now();
for (let day = 1; day <= Number(values.days); day += 1) {
  const today = step(world, content, perDay);
  log.push(...today);
  const counts = {};
  for (const event of today) counts[event.type] = (counts[event.type] ?? 0) + 1;
  const avg = (need) =>
    Math.round(world.colonists.reduce((sum, c) => sum + c.needs[need], 0) / world.colonists.length);
  console.log(
    `day ${day}: food ${world.colony.stock.food}, wood ${world.colony.stock.wood}, fuel ${world.colony.hearthFuel}; ` +
      `needs food ${avg('food')} rest ${avg('rest')} company ${avg('company')}; ` +
      Object.entries(counts)
        .sort()
        .map(([type, n]) => `${type} ${n}`)
        .join(', '),
  );
}
const ms = performance.now() - started;
console.log(`${values.days} days (${Number(values.days) * perDay} ticks) in ${Math.round(ms)} ms`);
for (const event of Number(values.lines) > 0 ? log.slice(-Number(values.lines)) : []) {
  const { day, hour, minute } = clockAt(event.tick, content.tuning);
  const time = `day ${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const why = event.causes.length ? ` (because #${event.causes.join(', #')})` : '';
  console.log(`#${event.id} ${time} ${renderEvent(event, world.colonists, content)}${why}`);
}
