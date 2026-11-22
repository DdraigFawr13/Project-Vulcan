// Tallies for callings' `lines` tests (6B Bundle 6, V-189 q9): each hour the new ledger lines of
// the events a bar counts add one for the person at the named actor place, with the last such
// line, kept in the calling system's state as `<event>@<actor>#<person>` and `…!` for the line.
import type { EngineContent, SimEvent } from '../core/index.ts';

const key = (event: string, actor: number, person: number): string => `${event}@${actor}#${person}`;

/** The events and actor places every bar counts. */
function counted(content: EngineContent): { event: string; actor: number }[] {
  return content.callings.callings.flatMap((c) =>
    c.stages
      .flatMap((s) => s.bar.flatMap((t) => [t, ...(t.or ?? [])]).filter((t) => t.test === 'lines'))
      .map((t) => ({ event: t.event ?? '', actor: t.actor ?? 0 })),
  );
}

/** Adds `fresh` lines to the tallies. */
export function tally(
  content: EngineContent,
  state: Record<string, number>,
  fresh: readonly SimEvent[],
) {
  const wanted = counted(content);
  for (const e of fresh)
    for (const w of wanted) {
      const person = e.type === w.event ? e.actors[w.actor] : undefined;
      if (person === undefined) continue;
      const k = key(w.event, w.actor, person);
      state[k] = (state[k] ?? 0) + 1;
      state[`${k}!`] = e.id;
    }
}

/** How many `event` lines name `person` at `actor`, and the last. */
export const countOf = (
  state: Record<string, number>,
  event: string,
  actor: number,
  person: number,
) => ({
  n: state[key(event, actor, person)] ?? 0,
  last: state[`${key(event, actor, person)}!`] ?? 0,
});
