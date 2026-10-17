// The ledger's "why?": an event's causes, their causes and so on back to the world's first line.
import type { SimEvent } from '../core/index.ts';

/** The event with this id, or undefined. Ids rise with log order, so a binary search finds it
 * even after old lines are trimmed from the front. */
export function findEvent(log: readonly SimEvent[], id: number): SimEvent | undefined {
  let lo = 0;
  let hi = log.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = log[mid]!.id;
    if (at === id) return log[mid];
    if (at < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

/**
 * The causes behind event `id`, nearest first: each cause once, with its depth (1 is a direct
 * cause). Stops after `limit` lines; a cause trimmed from the log is skipped.
 */
export function whyOf(
  log: readonly SimEvent[],
  id: number,
  limit = 12,
): { event: SimEvent; depth: number }[] {
  const out: { event: SimEvent; depth: number }[] = [];
  const seen = new Set<number>([id]);
  let frontier = findEvent(log, id)?.causes ?? [];
  for (let depth = 1; frontier.length && out.length < limit; depth += 1) {
    const next: number[] = [];
    for (const cause of frontier) {
      if (seen.has(cause) || out.length >= limit) continue;
      seen.add(cause);
      const event = findEvent(log, cause);
      if (!event) continue;
      out.push({ event, depth });
      next.push(...event.causes);
    }
    frontier = next;
  }
  return out;
}
