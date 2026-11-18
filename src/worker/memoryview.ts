// A person's memories and thought as the sheet shows them (P6.2, V-154): every held memory,
// strongest first, with its band and a line saying why it matters and how long it stays, and
// the thought line from the engine. Words only; the rules live in engine needs. A pure read.
import { content } from '../content/index.ts';
import {
  bandOf,
  clockAt,
  goesAt,
  heldMemoriesOf,
  memoryName,
  strongestFirst,
  thoughtOf,
  TICKS_PER_DAY,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import { leanWords } from './law.ts';
import type { MemoryView } from './protocol-people.ts';

const BANDS = { light: 'Light', heavy: 'Heavy', lasting: 'Lasting' } as const;

/** A game day in words: "6 Thawmonth". */
function dayWords(day: number): string {
  const c = clockAt(day * TICKS_PER_DAY, content.calendar);
  return `${c.day} ${content.calendar.monthNames[c.month]}`;
}

/** What came and when: "Hungry on 46 days, 6 Thawmonth to 5 Goldmonth." or "On 3 Mistmonth." */
function when(m: EntityRow): string {
  const came = content.memories.find((d) => d.id === m['memory'])?.heavy?.came ?? 'Came';
  const [first, last, days] = [m['first'] as number, m['last'] as number, m['days'] as number];
  return days > 1
    ? `${came} on ${days} days, ${dayWords(first)} to ${dayWords(last)}.`
    : `On ${dayWords(first)}.`;
}

/** The mood part: "+8 mood, 2 days left" while fresh, "−8 mood while it was fresh" after. */
function moodWords(world: WorldState, m: EntityRow, mood: number): string {
  const pts = `${mood > 0 ? '+' : '−'}${Math.abs(mood)} mood`;
  const left = Math.ceil(((m['until'] as number) - world.tick) / TICKS_PER_DAY);
  if (world.tick >= (m['until'] as number)) return `${pts} while it was fresh`;
  return `${pts}, ${left > 1 ? `${left} days left` : 'fades tomorrow'}`;
}

/** Every memory `p` holds, strongest first. */
export function memoriesView(world: WorldState, p: EntityRow): MemoryView[] {
  // A light one at the end of its days is gone though the hour's pass has not dropped it yet.
  const held = heldMemoriesOf(world, p.id).filter((m) => world.tick < goesAt(content, m));
  return strongestFirst(world, content, held).flatMap((m) => {
    const def = content.memories.find((d) => d.id === m['memory']);
    if (!def) return [];
    const band = bandOf(content, m['weight'] as number);
    const lean = world.tick < (m['until'] as number) ? leanWords(world, def.id) : undefined;
    const mood = `${moodWords(world, m, def.mood)}${lean ? `, ${lean}` : ''}`;
    const goes = goesAt(content, m);
    const stays =
      band === 'lasting'
        ? 'stays for life'
        : `stays until ${dayWords(Math.floor(goes / TICKS_PER_DAY))}`;
    const note = band === 'light' ? `${mood}.` : `${when(m)} ${mood}; ${stays}.`;
    return [
      { text: memoryName(world, content, m), band: BANDS[band], note, why: m['line'] as number },
    ];
  });
}

/** What is on their mind, in quotes for the sheet and the bubble. */
export function thoughtView(world: WorldState, p: EntityRow): { text: string; why: number } {
  const t = thoughtOf(world, content, p.id);
  return { text: `“${t.text}”`, why: t.why };
}
