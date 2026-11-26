// The season and year recaps for the page (Phase 6T slice 3, V-191): each recap in words, with its
// section headings from content (`annals.page`) and, under each sentence, the ledger lines it tells
// for "why?"; which new recaps pause play; and the feed that sends each recap once. A pure read of
// the world.
import { content } from '../content/index.ts';
import {
  annalsOf,
  charterOf,
  recordOf,
  tableOf,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine } from './protocol.ts';
import type { RecapSettings, RecapView } from './protocol-time.ts';

const { calendar, annals } = content;
const seasonName = (n: number): string => calendar.seasons[n] ?? '';
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `{Season}` and `{year}` in a page template; a recap written once the valley has its charter
 * names it (V-242). */
function kickerOf(world: WorldState, a: EntityRow): string {
  const kicker = (a['kind'] === 'year' ? annals.page.kickerYear : annals.page.kicker)
    .replace('{Season}', cap(seasonName(a['season'] as number)))
    .replace('{year}', String(a['year']));
  const charter = charterOf(world);
  return charter && (a['tick'] as number) >= charter.at ? `${kicker} · ${charter.name}` : kicker;
}

/** Recap `a` in words; `line` turns a cited ledger line into the page's line. */
export function recapView(
  world: WorldState,
  a: EntityRow,
  line: (e: SimEvent | Stub) => LedgerLine,
): RecapView {
  const sections: RecapView['sections'] = [];
  for (const t of tableOf(world, 'annalText')) {
    if (t['annal'] !== a.id) continue;
    const id = t['section'] as string;
    const lines = (t['lines'] as number[]).flatMap((n) => {
      const e = recordOf(world, n);
      return e ? [line(e)] : [];
    });
    const sentence = { text: t['text'] as string, lines };
    const last = sections.at(-1);
    if (last?.id === id) last.sentences.push(sentence);
    else {
      const head = annals.page.heads[id];
      sections.push({ id, ...(head !== undefined && { head }), sentences: [sentence] });
    }
  }
  return {
    id: a.id,
    kind: a['kind'] === 'year' ? 'year' : 'season',
    kicker: kickerOf(world, a),
    title: cap(a['head'] as string),
    sections,
  };
}

/** How many recaps the world holds. */
export const recapCount = (world: WorldState): number => tableOf(world, 'annal').length;

/** Whether recaps written since there were `before` should pause play: one of a kind switched on. */
export function recapPauses(world: WorldState, before: number, on: RecapSettings): boolean {
  const rows = tableOf(world, 'annal');
  for (let i = before; i < rows.length; i += 1)
    if (rows[i]!['kind'] === 'year' ? on.year : on.season) return true;
  return false;
}

/** Sends each recap once: every recap after `reset` (a world began or loaded), then the new ones. */
export function recapFeed(): {
  reset(): void;
  next(world: WorldState, line: (e: SimEvent | Stub) => LedgerLine): RecapView[] | undefined;
} {
  let sent = 0;
  let fresh = true;
  return {
    reset() {
      [sent, fresh] = [0, true];
    },
    next(world, line) {
      const count = recapCount(world);
      if (count === sent && !fresh) return undefined;
      fresh = false;
      const news = [...annalsOf(world)].reverse().slice(sent);
      sent = count;
      return news.map((a) => recapView(world, a, line));
    },
  };
}
