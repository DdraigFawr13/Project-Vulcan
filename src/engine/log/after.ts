// The ledger lines since a reader last looked, for systems that read the ledger hourly (tales,
// teach). One home for the walk back from the end (shape ratchet: copied helpers).
import type { SimEvent } from '../core/index.ts';

/** The ledger lines after id `seen`, oldest first. */
export function linesAfter(log: readonly SimEvent[], seen: number): SimEvent[] {
  let k = log.length;
  while (k > 0 && log[k - 1]!.id > seen) k -= 1;
  return log.slice(k);
}
