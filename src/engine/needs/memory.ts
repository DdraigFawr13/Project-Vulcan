// Memories (P4.8 first slice, V-091): a person holds the memories content lists in memories.json,
// each with a mood (points, counted `life.memory.weight` times in their mood) and a number of
// days it lasts. Other systems add one with `addMemory`; the needs system lets them expire each
// hour and adds the live ones to the mood. Adding and expiring write no ledger line: the cause
// kept on the row is what "why?" follows.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const MEMORY_TABLES: Schemas = {
  /** `memory` is a memories.json id, `until` the tick it fades, `line` the event that made it
   * (or last refreshed it) and `about` whom it concerns (0 for no one). */
  memory: { person: 'entity', memory: 'text', until: 'int', line: 'event', about: 'entity' },
};

const rowsOf = (world: WorldState): EntityRow[] => world.entities['memory'] ?? [];

/** A person's live memories. */
export const memoriesOf = (world: WorldState, person: number): EntityRow[] =>
  rowsOf(world).filter((m) => m['person'] === person);

/**
 * Gives `person` the memory `id`, caused by event `cause`. One they already hold that does not
 * stack has its fading pushed back; a stacking one (content `stacks`) adds another row until it
 * holds that many, then refreshes the one nearest to fading. An unknown id is ignored.
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
  const held = memoriesOf(world, person).filter((m) => m['memory'] === id);
  if (held.length < (def.stacks ?? 1)) {
    addEntity(world, 'memory', { person, memory: id, until, line: cause, about });
    return;
  }
  const oldest = held.reduce((a, b) => ((b['until'] as number) < (a['until'] as number) ? b : a));
  Object.assign(oldest, { until, line: cause, about });
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

/** The mood the live memories add: each one's points times `life.memory.weight`. */
export function memoryMood(world: WorldState, content: EngineContent, person: number): number {
  let sum = 0;
  for (const m of memoriesOf(world, person)) {
    const points = content.memories.find((d) => d.id === m['memory'])?.mood ?? 0;
    sum += points * content.life.memory.weight;
  }
  return sum;
}

/** Drops the memories that have faded. */
export function expireMemories(world: WorldState): void {
  for (const m of rowsOf(world).filter((r) => world.tick >= (r['until'] as number)))
    removeEntity(world, 'memory', m.id);
}

/** A person's warmth warning line (V-046, P4.8): the need's line moved by their traits and each
 * memory they hold, as life.json `warmthLine` says, kept within the scale. */
export function warmLineOf(world: WorldState, content: EngineContent, person: number): number {
  const base = content.life.needs.find((n) => n.id === 'warmth')?.low ?? 0;
  const { traits, memories } = content.life.warmthLine;
  let line = base;
  for (const t of world.entities['trait'] ?? [])
    if (t['person'] === person) line += traits[t['trait'] as string] ?? 0;
  for (const m of memoriesOf(world, person)) line += memories[m['memory'] as string] ?? 0;
  return Math.max(0, Math.min(content.life.scale, line));
}
