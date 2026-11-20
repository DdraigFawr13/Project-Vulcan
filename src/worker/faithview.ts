// Faith as the page shows it (6B Bundle 4, P6.8, V-187): a shrine's tile rows (its faith, its
// keeper, who prayed there this week), a person's faith on the Memories tab, and the feast days
// under the Feasts law. Words only; the rules live in engine faith. Pure reads of the world.
import { content } from '../content/index.ts';
import {
  clockAt,
  creedOf,
  creedsOf,
  dayWords,
  devotionWord,
  faithOf,
  holdersOf,
  holydaysOf,
  keptDays,
  list,
  recordOf,
  TICKS_PER_DAY,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine } from './protocol.ts';
import type { PieceView } from './protocol-build.ts';
import type { FeastDayView } from './protocol-law.ts';
import type { SelfView } from './protocol-people.ts';

/** A shrine's rows on the tile page: its faith and holders, its keeper and who prayed this week. */
export function shrineView(
  world: WorldState,
  piece: EntityRow,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): PieceView['shrine'] {
  const creed = creedsOf(world).find((c) => c['shrine'] === piece.id);
  if (!creed) return undefined;
  const holders = holdersOf(world, creed.id);
  const priest = holders.find((p) => p.id === creed['priest']);
  const week = world.tick - 7 * TICKS_PER_DAY;
  const prayed = holders
    .filter((p) => ((faithOf(world, p.id)?.['prayed'] as number) ?? 0) > Math.max(week, 0))
    .map((p) => p['name'] as string);
  const named = recordOf(world, creed['named'] as number);
  return {
    faith: `${creed['name'] as string}, held by ${holders.length}`,
    keeper: priest ? `${priest['name'] as string}, ${creed['title'] as string}` : 'nobody yet',
    prayed: prayed.length ? `prayed here: ${list(prayed)}` : 'nobody has prayed here this week',
    ...(named && priest && { named: lineOf(named) }),
  };
}

/** A person's faith for the Memories tab: "The Wells · devout · Wellkeeper" and what it holds. */
export function faithSelf(world: WorldState, p: EntityRow): SelfView['faith'] {
  const f = faithOf(world, p.id);
  const creed = creedOf(world, p.id);
  if (!f || !creed) return undefined;
  const def = content.faiths.defs.find((d) => d.id === creed['faith']);
  const priest = creed['priest'] === p.id;
  const parts = [creed['name'] as string, devotionWord(content, f['devotion'] as number)];
  if (priest) parts.push(creed['title'] as string);
  const note = def ? `Holds ${list(def.sacred)} sacred; abhors ${def.abhors}.` : '';
  return { text: parts.join(' · '), note, why: priest ? (creed['named'] as number) : 0 };
}

const dateOf = (month: number, day: number): string =>
  `${day} ${content.calendar.monthNames[month]!}`;

/** The feast days under the Feasts law: the harvest home, then each day asked for, in the order
 * asked, with whether the law keeps it and when it was last kept. */
export function feastDaysView(world: WorldState): FeastDayView[] {
  const home = (world.entities['feast'] ?? [])
    .filter((f) => (f['eaten'] as number) > 0 && !(f['couple'] as number[]).length && !f['holy'])
    .sort((a, b) => (a['eaten'] as number) - (b['eaten'] as number))[0];
  const out: FeastDayView[] = [
    {
      text: 'Harvest home, when the last field is in',
      note: home ? 'Kept every year.' : 'Kept every year, once the first harvest is in.',
      why: home ? (home['eaten'] as number) : 0,
    },
  ];
  const kept = new Set(keptDays(world, content).map((d) => d.id));
  const year = clockAt(world.tick, content.calendar).year;
  const asked = holydaysOf(world)
    .filter((d) => d['state'] === 'asked')
    .sort((a, b) => (a['line'] as number) - (b['line'] as number));
  for (const d of asked) {
    const last = d['kept'] as number;
    const state = !kept.has(d.id)
      ? 'Waiting: the Feasts law has no room for it.'
      : last === year
        ? 'Kept this year.'
        : last
          ? `Last kept in year ${last}.`
          : 'Not yet kept.';
    out.push({
      text: `${d['name'] as string}, ${dateOf(d['month'] as number, d['day'] as number)}`,
      note: `${dayWords(world, content, d).why} ${state}`,
      why: d['line'] as number,
    });
  }
  return out;
}
