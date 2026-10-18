// The ledger's "why?": an event's causes, their causes and so on back to the world's first line,
// or to an "older record" where the chain leaves the recent days.
import type { SimEvent, Stub, WorldState } from '../core/index.ts';

/** The line or stub with this id, or undefined. Ids rise with order in both lists, so a binary
 * search finds it. */
export function findEvent<T extends Stub>(lines: readonly T[], id: number): T | undefined {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = lines[mid]!.id;
    if (at === id) return lines[mid];
    if (at < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

type Ledger = Pick<WorldState, 'log' | 'stubs'>;

/** The recent line with this id, or the stub of an older one the world still cites. */
export const recordOf = (world: Ledger, id: number): SimEvent | Stub | undefined =>
  findEvent(world.log, id) ?? findEvent(world.stubs, id);

/** A cause in a "why?" chain. `older` is a stub: the line's day is sealed and the chain ends. */
export interface Cause {
  event: SimEvent | Stub;
  depth: number;
  older: boolean;
}

/**
 * The causes behind event `id`, nearest first: each cause once, with its depth (1 is a direct
 * cause). Stops after `limit` lines; a chain ends at an older record, and a cause the world no
 * longer cites at all is skipped.
 */
export function whyOf(world: Ledger, id: number, limit = 12): Cause[] {
  const out: Cause[] = [];
  const seen = new Set<number>([id]);
  let frontier = findEvent(world.log, id)?.causes ?? [];
  for (let depth = 1; frontier.length && out.length < limit; depth += 1) {
    const next: number[] = [];
    for (const cause of frontier) {
      if (seen.has(cause) || out.length >= limit) continue;
      seen.add(cause);
      const event = findEvent(world.log, cause);
      if (event) {
        out.push({ event, depth, older: false });
        next.push(...event.causes);
        continue;
      }
      const stub = findEvent(world.stubs, cause);
      if (stub) out.push({ event: stub, depth, older: true });
    }
    frontier = next;
  }
  return out;
}
