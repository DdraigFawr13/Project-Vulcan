// Sealing old days (ARCHITECTURE "Event log"): the running world keeps its recent days of lines in
// full; each midnight the day that falls out of that window leaves the log as a segment for the
// worker to archive, and only the older lines the world still cites stay, as stubs.
import { hashString, TICKS_PER_DAY, type SimEvent, type WorldState } from '../core/index.ts';
import { toNdjson } from './render.ts';

/** How many game days of lines the running world keeps in full: a game week. */
export const RECENT_DAYS = 7;

/**
 * Seals every whole day older than the recent window (`recentDays`) into `world.sealed` and `world.segments`,
 * keeping as stubs the older lines that `cited` names, that a recent line cites, or the world's
 * first line. Stubs no longer cited are dropped. Run at midnight, between systems' work.
 */
export function sealDays(world: WorldState, cited: Set<number>, recentDays = RECENT_DAYS): void {
  const cutoff = (Math.floor(world.tick / TICKS_PER_DAY) - recentDays) * TICKS_PER_DAY;
  let end = 0;
  while (end < world.log.length && world.log[end]!.tick < cutoff) end += 1;
  const old = world.log.slice(0, end);
  world.log.splice(0, end);
  for (const line of world.log) for (const cause of line.causes) cited.add(cause);
  cited.add(world.begunEvent);
  const stubs = world.stubs.filter((s) => cited.has(s.id));
  for (const line of old)
    if (cited.has(line.id)) stubs.push({ id: line.id, tick: line.tick, type: line.type });
  world.stubs = stubs;
  for (let at = 0; at < old.length;) {
    const day = Math.floor(old[at]!.tick / TICKS_PER_DAY);
    let to = at;
    while (to < old.length && Math.floor(old[to]!.tick / TICKS_PER_DAY) === day) to += 1;
    seal(world, day, old.slice(at, to));
    at = to;
  }
}

function seal(world: WorldState, day: number, lines: SimEvent[]): void {
  const text = toNdjson(lines);
  const first = lines[0]!.id;
  const last = lines.at(-1)!.id;
  const key = `${world.seed}:${first}-${last}:${hashString(text).toString(36)}`;
  world.segments.push({ day, key, first, last });
  world.sealed.push({ day, key, first, last, text });
}

/** Every line of a world that has never handed its sealed days to a worker, oldest first: for
 * headless runs (tests and tools), where `world.sealed` holds the whole archive. */
export const allLines = (world: Pick<WorldState, 'sealed' | 'log'>): SimEvent[] => [
  ...world.sealed.flatMap((s) =>
    s.text
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as SimEvent),
  ),
  ...world.log,
];
