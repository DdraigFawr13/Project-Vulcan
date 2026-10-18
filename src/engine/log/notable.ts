// Notable lines (P2.6, P2.7): the content list of what the alert feed shows and where skip ahead
// stops. An event type is notable when its template entry has `notable`: `{}` for every line of
// that type, or data values the line must have, alternatives split by `|` (a mood that fell to
// Low or Miserable, not one that rose or fell to Steady).
import type { SimEvent } from '../core/index.ts';

export type Notable = (event: Pick<SimEvent, 'type' | 'data'>) => boolean;

export function notableOf(
  events: readonly { id: string; notable?: Readonly<Record<string, string>> }[],
): Notable {
  const when = new Map<string, [string, string[]][]>();
  for (const e of events)
    if (e.notable)
      when.set(
        e.id,
        Object.entries(e.notable).map(([k, v]) => [k, v.split('|')]),
      );
  return (event) => {
    const needs = when.get(event.type);
    return needs !== undefined && needs.every(([k, v]) => v.includes(String(event.data[k])));
  };
}
