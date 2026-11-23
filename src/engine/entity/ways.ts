// What a way of working does for the one who knows it (6C Slice 5 part 3, V-219), read as data
// from engine discover's `knows` table so the trades need not import it.
import type { EngineContent, WorldState } from '../core/index.ts';

/** A way's effect in per cent, whoever knows it. */
export const wayBy = (content: EngineContent, method: string): number =>
  content.methods.methods.find((m) => m.id === method)?.effect.by ?? 0;

/** The per cent a way's effect gives `person` for work they do themselves: its `effect.by` if
 * they know the way, else 0. */
export function wayEffect(
  world: WorldState,
  content: EngineContent,
  person: number,
  method: string,
): number {
  const by = wayBy(content, method);
  const knows = (world.entities['knows'] ?? []).some(
    (k) => k['person'] === person && k['method'] === method,
  );
  return knows ? by : 0;
}

/** `minutes` of work cut by the way's per cent for a knower (at least one minute). */
export function lessMinutes(
  world: WorldState,
  content: EngineContent,
  person: number,
  method: string,
  minutes: number,
): number {
  const by = wayEffect(world, content, person, method);
  return by ? Math.max(1, Math.ceil((minutes * (100 - by)) / 100)) : minutes;
}
