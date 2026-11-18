// Memories (P4.8 first slice, V-091; weights P6.2, V-154): a person holds the memories content
// lists in memories.json, each with a mood (points, counted `life.memory.weight` times in their
// mood while it is fresh) and a number of days it stays fresh. Each row also carries a weight,
// how much it touched them: content's `weight` (1 when absent), 1 more the first time they ever
// hold it, and for a memory with a `heavy` name 1 more for each `spellDays` it came in the last
// `windowDays`. Light ones go when their days are up; heavy ones (`life.memory.heavy`) stay,
// without mood, until `lingerDays` after they last came; lasting ones (`lasting`) stay for life.
// Adding and expiring write no ledger line: the cause kept on the row is what "why?" follows.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type MemoryDef,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const MEMORY_TABLES: Schemas = {
  /** `memory` is a memories.json id, `until` the tick it stops being fresh, `line` the event
   * that made it (or last refreshed it) and `about` whom it concerns (0 for no one). `weight`
   * is how much it touched them; `since` the tick this run of it began; `first` and `last` the
   * game days it first and last came in this run, `days` how many days it came, `mask` which of
   * the last `windowDays` it came (bit 0 today) and `fresh` 1 if it was their first time. */
  memory: {
    person: 'entity',
    memory: 'text',
    until: 'int',
    line: 'event',
    about: 'entity',
    weight: 'count',
    since: 'int',
    first: 'int',
    last: 'int',
    days: 'count',
    mask: 'int',
    fresh: 'count',
  },
  /** One row a person for each memory they have ever held: a first time weighs more. */
  memorySeen: { person: 'entity', memory: 'text' },
};

const rowsOf = (world: WorldState): EntityRow[] => world.entities['memory'] ?? [];
const dayOf = (tick: number): number => Math.floor(tick / TICKS_PER_DAY);

/** Every memory a person holds, fresh or lingering (the Memories tab, the thought line). */
export const heldMemoriesOf = (world: WorldState, person: number): EntityRow[] =>
  rowsOf(world).filter((m) => m['person'] === person);

/** A person's fresh memories: the ones that move their mood, warmth line and law answers. */
export const memoriesOf = (world: WorldState, person: number): EntityRow[] =>
  heldMemoriesOf(world, person).filter((m) => world.tick < (m['until'] as number));

export type Band = 'light' | 'heavy' | 'lasting';

/** A weight's band (life.memory `heavy`, `lasting`). */
export function bandOf(content: EngineContent, weight: number): Band {
  const { heavy, lasting } = content.life.memory;
  return weight >= lasting ? 'lasting' : weight >= heavy ? 'heavy' : 'light';
}

const bits = (mask: number): number => {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n += 1;
  return n;
};

/** The row's weight now (never less than it was): content's, a first time's point, the run. */
function weighed(
  content: EngineContent,
  def: MemoryDef,
  row: Readonly<Record<string, unknown>>,
): number {
  const spell = content.life.memory.spellDays;
  const run = def.heavy ? Math.floor(bits(row['mask'] as number) / spell) : 0;
  const now = (def.weight ?? 1) + (row['fresh'] as number) + run;
  return Math.max(row['weight'] as number, now);
}

/** Marks today on a row's run of days. */
function cameToday(content: EngineContent, row: EntityRow, today: number): void {
  const gap = today - (row['last'] as number);
  if (gap <= 0) return;
  const span = content.life.memory.windowDays;
  // Shift the days along by `gap`, dropping those older than the window (whole 28-bit masks).
  const kept = gap >= span ? 0 : (row['mask'] as number) % (1 << (span - gap));
  const shifted = kept << gap;
  Object.assign(row, { mask: shifted + 1, last: today, days: (row['days'] as number) + 1 });
}

/**
 * Gives `person` the memory `id`, caused by event `cause`. One they already hold (fresh or
 * lingering) that does not stack is made fresh again and its run goes on; a stacking one
 * (content `stacks`) adds another row until it holds that many, then refreshes the one nearest
 * to fading. An unknown id is ignored.
 */
export function addMemory(
  ctx: SystemContext,
  person: number,
  id: string,
  cause: number,
  about = 0,
): void {
  const { world, content } = ctx;
  const def = content.memories.find((m) => m.id === id);
  if (!def) return;
  const until = world.tick + def.decayDays * TICKS_PER_DAY;
  const today = dayOf(world.tick);
  const held = heldMemoriesOf(world, person).filter((m) => m['memory'] === id);
  if (held.length < (def.stacks ?? 1)) {
    const seen = (world.entities['memorySeen'] ?? []).some(
      (s) => s['person'] === person && s['memory'] === id,
    );
    if (!seen) addEntity(world, 'memorySeen', { person, memory: id });
    const fresh = seen ? 0 : 1;
    const row = { weight: 0, mask: 1, fresh };
    addEntity(world, 'memory', {
      ...{ person, memory: id, until, line: cause, about, since: world.tick },
      ...{ first: today, last: today, days: 1, mask: 1, fresh },
      weight: weighed(content, def, row),
    });
    return;
  }
  const oldest = held.reduce((a, b) => ((b['until'] as number) < (a['until'] as number) ? b : a));
  Object.assign(oldest, { until, line: cause, about });
  cameToday(content, oldest, today);
  oldest['weight'] = weighed(content, def, oldest);
}

/** Gives each of `people` the memory `id` (a shared one: `farm.harvestHome` calls this with its
 * event's actors and its own id as the cause, giving `harvested`). */
export function addMemories(
  ctx: SystemContext,
  people: readonly number[],
  id: string,
  cause: number,
  about = 0,
): void {
  for (const person of people) addMemory(ctx, person, id, cause, about);
}

/** The mood the fresh memories add: each one's points times `life.memory.weight`. */
export function memoryMood(world: WorldState, content: EngineContent, person: number): number {
  let sum = 0;
  for (const m of memoriesOf(world, person)) {
    const points = content.memories.find((d) => d.id === m['memory'])?.mood ?? 0;
    sum += points * content.life.memory.weight;
  }
  return sum;
}

/** The tick a held memory goes: its fresh days for a light one, `lingerDays` after it last
 * came for a heavy one, never for a lasting one. */
export function goesAt(content: EngineContent, m: EntityRow): number {
  const band = bandOf(content, m['weight'] as number);
  if (band === 'lasting') return Infinity;
  if (band === 'light') return m['until'] as number;
  const linger = ((m['last'] as number) + content.life.memory.lingerDays) * TICKS_PER_DAY;
  return Math.max(m['until'] as number, linger);
}

/** Drops the memories that have gone. */
export function expireMemories(world: WorldState, content: EngineContent): void {
  for (const m of rowsOf(world).filter((r) => world.tick >= goesAt(content, r)))
    removeEntity(world, 'memory', m.id);
}

/** A person's warmth warning line (V-046, P4.8): the need's line moved by their traits and each
 * fresh memory they hold, as life.json `warmthLine` says, kept within the scale. */
export function warmLineOf(world: WorldState, content: EngineContent, person: number): number {
  const base = content.life.needs.find((n) => n.id === 'warmth')?.low ?? 0;
  const { traits, memories } = content.life.warmthLine;
  let line = base;
  for (const t of world.entities['trait'] ?? [])
    if (t['person'] === person) line += traits[t['trait'] as string] ?? 0;
  for (const m of memoriesOf(world, person)) line += memories[m['memory'] as string] ?? 0;
  return Math.max(0, Math.min(content.life.scale, line));
}
