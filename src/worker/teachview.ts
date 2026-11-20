// Who taught whom, as the Memories tab shows it (6B Bundle 6, P6.13, V-189): someone's master or
// apprentice now, and each teacher they learned from and learner they taught, with the levels and
// the line behind it. Words only; the rules live in engine teach. A pure read.
import { content } from '../content/index.ts';
import {
  apprenticesOf,
  clockAt,
  skillWord,
  taughtOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { SelfView } from './protocol-people.ts';

type Row = NonNullable<SelfView['teaching']>[number];

const nameOf = (world: WorldState, id: unknown): string =>
  ((world.entities['person'] ?? []).find((p) => p.id === id)?.['name'] as string) ?? 'someone';

function on(tick: number): string {
  const c = clockAt(tick, content.calendar);
  return `${c.day} ${content.calendar.monthNames[c.month]!}`;
}

/** The bond `p` is in now, as apprentice or master. */
function bondRows(world: WorldState, p: EntityRow): Row[] {
  return apprenticesOf(world)
    .filter((a) => !a['ended'] && (a['learner'] === p.id || a['master'] === p.id))
    .map((a) => {
      const skill = skillWord(content, a['skill'] as string);
      const text =
        a['learner'] === p.id
          ? `Apprentice to ${nameOf(world, a['master'])} in ${skill}, since ${on(a['since'] as number)}.`
          : `Teaching ${nameOf(world, a['learner'])} ${skill} as their apprentice.`;
      return { text, why: a['line'] as number };
    });
}

/** Who taught `p`, and whom `p` taught, with the levels. */
function taughtRows(world: WorldState, p: EntityRow): Row[] {
  return taughtOf(world).flatMap((r) => {
    const skill = skillWord(content, r['skill'] as string);
    const levels = `${skill} ${r['from'] as number} to ${r['to'] as number}`;
    if (r['learner'] === p.id)
      return [
        { text: `Taught by ${nameOf(world, r['teacher'])} (${levels}).`, why: r['last'] as number },
      ];
    if (r['teacher'] === p.id)
      return [
        { text: `Taught ${nameOf(world, r['learner'])} (${levels}).`, why: r['last'] as number },
      ];
    return [];
  });
}

/** `p`'s teaching lines, or none. */
export function teachSelf(world: WorldState, p: EntityRow): SelfView['teaching'] {
  const rows = [...bondRows(world, p), ...taughtRows(world, p)];
  return rows.length ? rows : undefined;
}
