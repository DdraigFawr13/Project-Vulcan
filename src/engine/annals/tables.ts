// The annals tables and their reads (Phase 6T, V-191): the lines a recap will tell, kept with their
// words until the year's recap is written; the recaps; and each recap's sentences, each citing the
// lines it tells.
import type { EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';
import { tableOf } from '../entity/index.ts';

export const ANNALS_TABLES: Schemas = {
  /** A kept line of this year: its type, its data as JSON (so it outlives the sealed day), its
   * actors, and the year and 0-based season it fell in. Gone once the year's recap is written. */
  annalLine: {
    ...{ event: 'event', type: 'text', words: 'text', actors: 'ints' },
    ...{ year: 'int', season: 'int' },
  },
  /** A recap: `kind` `season` or `year`, its year and season (the year's last, for a year), the
   * tick it was written, its `title` and bare `head`, and the season line written at its turn
   * (the one that opens the next span). */
  annal: {
    ...{ kind: 'text', year: 'int', season: 'int', tick: 'int' },
    ...{ title: 'text', head: 'text', line: 'event' },
  },
  /** One sentence of a recap: its section (annals.json, `numbers`, `say`, or a season's name in a
   * year), its words, the lines it tells (for "why?") and its weight. */
  annalText: { annal: 'entity', section: 'text', text: 'text', lines: 'events', weight: 'count' },
};

/** Every recap, newest first. */
export const annalsOf = (world: WorldState): EntityRow[] => [...tableOf(world, 'annal')].reverse();

/** A recap's sentences in order. */
export const annalTextOf = (world: WorldState, annal: number): EntityRow[] =>
  tableOf(world, 'annalText').filter((t) => t['annal'] === annal);

/** A recap's paragraphs: its sentences joined by section, in order. */
export function recapOf(world: WorldState, annal: number): { section: string; text: string }[] {
  const out: { section: string; text: string }[] = [];
  for (const t of annalTextOf(world, annal)) {
    const last = out.at(-1);
    if (last && last.section === t['section']) last.text += ` ${t['text'] as string}`;
    else out.push({ section: t['section'] as string, text: t['text'] as string });
  }
  return out;
}
