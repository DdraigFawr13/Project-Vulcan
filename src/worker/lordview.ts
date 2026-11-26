// The lord as the page shows him (6C Slice 4, V-237): who he is and his favour with its ladder and
// causes for the Lord law on the Laws sheet, and the valley's card and each village's regard for
// the Region sheet. Pure reads of the world and content; every word is made here (GAME-02), and
// nothing is shown before his reeve has named him.
import { content } from '../content/index.ts';
import {
  charterOf,
  clockAt,
  favourAt,
  favourCauses,
  lordName,
  lordRow,
  pronounsOf,
  TICKS_PER_DAY,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { LordView, RegardView, RegionDetail } from './protocol-lord.ts';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The lord once his reeve has named him; none before. */
export const namedLord = (world: WorldState): EntityRow | undefined => {
  const lord = lordRow(world);
  return lord && lord['named'] ? lord : undefined;
};

/** "Warlord Ogrgul of the Horde of Ashaglug, quick to draw a sword and slow to count the cost". */
function whoIs(lord: EntityRow): string {
  const young = lord['child'] ? 'the young ' : '';
  const temper = lord['line'] ? `, ${lord['line'] as string}` : '';
  return `${young}${lordName(lord)} of the ${lord['realm'] as string}${temper}`;
}

const his = (lord: EntityRow): string => (lord['sex'] === 'f' ? 'Her' : 'His');
const heOf = (lord: EntityRow): string => (lord['sex'] === 'f' ? 'she' : 'he');
const selfOf = (lord: EntityRow): string => (lord['sex'] === 'f' ? 'herself' : 'himself');
/** "third" for 3 (the lord's visit, 6C Slice 7). */
const ordinal = (n: number): string =>
  ['', 'first', 'second', 'third', 'fourth', 'fifth'][n] ?? `${n}th`;

/** The ladder in one line, from content, then how long a cause counts. */
function ladderLine(lord: EntityRow): string {
  const f = content.lord.favour;
  const words = pronounsOf(lord);
  const said = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, k: string) => words[k as 'his'] ?? '');
  const { least, years: old } = content.lord.charter;
  const when = (id: string) =>
    id === 'charter' ? `, once ${least} or more live here and ${old} years have passed` : '';
  // The falls first, as listed, then the rises from the lowest (the charter at 80, V-242).
  const steps = [...f.ladder]
    .sort((a, b) => (a.above ?? 0) - (b.above ?? 0))
    .map((s) =>
      s.below !== undefined
        ? `At ${s.below} or less, ${said(s.text)}.`
        : `At ${s.above ?? 0} or more, ${said(s.text)}${when(s.id)}.`,
    );
  const years = Math.round(
    f.days / (content.calendar.daysPerMonth * content.calendar.monthsPerYear),
  );
  return `${steps.join(' ')} Each cause counts for ${years} year${years === 1 ? '' : 's'}.`;
}

/** The favour's causes still counting, newest first, each with the year it came. */
function causesView(world: WorldState): LordView['causes'] {
  const span = content.lord.favour.days * TICKS_PER_DAY;
  return favourCauses(world)
    .sort((a, b) => (b['until'] as number) - (a['until'] as number) || b.id - a.id)
    .map((c) => {
      const year = clockAt((c['until'] as number) - span, content.calendar).year;
      return {
        by: c['by'] as number,
        text: `${cap(c['text'] as string)}, Year ${year}`,
        why: c['line'] as number,
      };
    });
}

/** The Lord law's block: who he is, his favour with every step marked, and its causes. */
export function lordView(world: WorldState): LordView | undefined {
  const lord = namedLord(world);
  if (!lord) return undefined;
  return {
    who:
      `The valley is held by ${whoIs(lord)}. ${his(lord)} reeve ${lord['reeve'] as string} ` +
      `comes the morning after each harvest home; every ${ordinal(content.lord.visit.every)} ` +
      `harvest home ${heOf(lord)} comes ${selfOf(lord)} for the supper.`,
    whoWhy: lord['named'] as number,
    favour: favourAt(world, content),
    steps: content.lord.favour.ladder.map((s) => s.below ?? s.above ?? 0).sort((a, b) => a - b),
    ladder: ladderLine(lord),
    head: `${his(lord)} favour`,
    causes: causesView(world),
  };
}

/** The settled valley's card and each village's regard, for the Region sheet. */
export function regionDetail(world: WorldState): RegionDetail & { regard: RegardView[] } {
  const lord = namedLord(world);
  const regard = (world.entities['regard'] ?? []).map((r) => {
    const gift = r['gift'] ? ' A gift waits for their next stranger.' : '';
    return {
      place: r['place'] as string,
      regard: r['regard'] as number,
      text: `Its regard for the colony: ${r['regard'] as number}.${gift}`,
      why: r['line'] as number,
    };
  });
  const charter = charterOf(world);
  return {
    ...(charter && { charter: { name: charter.name, why: charter.line } }),
    ...(lord && {
      lord: {
        text: `Held by ${whoIs(lord)}. ${his(lord)} favour: ${favourAt(world, content)} of 100.`,
        why: lord['named'] as number,
      },
    }),
    regard,
  };
}
