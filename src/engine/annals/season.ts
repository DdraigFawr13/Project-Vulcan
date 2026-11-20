// A season's recap (V-191): its kept lines grouped by kind, each section's weightiest kinds told in
// the order they first happened, then who leads, the season's numbers and what people say. Every
// sentence cites the lines it tells; the title is the weightiest titled line's.
import {
  clockAt,
  type AnnalLineDef,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, alive, personName, tableOf } from '../entity/index.ts';
import { housesOf } from '../build/index.ts';
import { colonyRow } from '../colony/index.ts';
import { foodDays } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { taleDef, taleText } from '../tales/index.ts';
import { entryOf } from './collect.ts';
import { cap, fill, noun, sentenceOf, type Words } from './words.ts';

export interface Sentence {
  section: string;
  text: string;
  lines: number[];
  weight: number;
}

interface Group {
  section: number;
  def: AnnalLineDef;
  type: string;
  rows: EntityRow[];
}

const wordsOf = (row: EntityRow): Words => JSON.parse(row['words'] as string) as Words;

/** The kept lines grouped by the entry that tells them, in the order each kind first happened. */
export function groupsOf(content: EngineContent, rows: readonly EntityRow[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const type = row['type'] as string;
    const at = entryOf(content, type, wordsOf(row));
    if (!at) continue;
    const key = `${at.section}:${at.line}`;
    const g = groups.get(key);
    if (g) g.rows.push(row);
    else groups.set(key, { section: at.section, def: at.def, type, rows: [row] });
  }
  return [...groups.values()];
}

const heavier = (a: Group, b: Group): number =>
  b.def.weight - a.def.weight || a.rows[0]!.id - b.rows[0]!.id;

/** The bare title: the weightiest titled kind's, from its first line, or `quiet`. */
export function headOf(groups: readonly Group[], quiet: string): { head: string; weight: number } {
  const best = groups.filter((g) => g.def.title !== undefined).sort(heavier)[0];
  return best
    ? { head: fill(best.def.title!, wordsOf(best.rows[0]!)), weight: best.def.weight }
    : { head: quiet, weight: 0 };
}

/** One sentence a section tells for each of its weightiest `max` kinds, oldest first. */
function told(content: EngineContent, groups: readonly Group[]): Sentence[] {
  const out: Sentence[] = [];
  content.annals.sections.forEach((s, k) => {
    const chosen = groups
      .filter((g) => g.section === k)
      .sort(heavier)
      .slice(0, s.max)
      .sort((a, b) => a.rows[0]!.id - b.rows[0]!.id);
    for (const g of chosen)
      out.push({
        section: s.id,
        text: sentenceOf(content, g.def, g.type, g.rows.map(wordsOf)),
        lines: g.rows.slice(0, content.annals.year.cite).map((r) => r['event'] as number),
        weight: g.def.weight,
      });
  });
  return out;
}

/** The elder, when no line this season says who leads. */
function still(world: WorldState, content: EngineContent, said: readonly Sentence[]): Sentence[] {
  const row = colonyRow(world);
  const elder = row?.['elder'] as number | undefined;
  if (!elder || !row?.['line'] || said.some((s) => s.section === 'leads')) return [];
  const text = fill(content.annals.still, { name: personName(world, elder) });
  return [{ section: 'leads', text, lines: [row['line'] as number], weight: 0 }];
}

/** The valley at the span's end: people, houses, the store's days of food and levels open. */
export function numbersOf(world: WorldState, content: EngineContent, line: number): Sentence {
  const { numbers } = content.annals;
  const people = alive(world).length;
  const homes = housesOf(world).filter((h) => !h['of'] && h['state'] === 'built').length;
  const levels = world.map.levels.filter(Boolean).length;
  const n = (key: string, v: number) => noun(content, numbers.nouns, key, v);
  const words = {
    people: n('people', people),
    homes: n('homes', homes),
    food: n('food', foodDays(world, content, people).days),
    levels: n('levels', levels),
  };
  const text = fill(numbers.text, words) + (levels ? ` ${cap(fill(numbers.levels, words))}` : '');
  return { section: 'numbers', text, lines: line ? [line] : [], weight: 0 };
}

/** What people say: the most-held tales of what happened since line `since` (then older ones),
 * each as the holder who tells it most bent, newest story first on a tie. */
export function sayOf(world: WorldState, content: EngineContent, since: number): Sentence[] {
  const tales = tableOf(world, 'tale');
  const stories = new Map(tableOf(world, 'story').map((s) => [s.id, s]));
  const held = new Map<number, EntityRow[]>();
  for (const t of tales) {
    const s = t['story'] as number;
    held.set(s, [...(held.get(s) ?? []), t]);
  }
  const fresh = (id: number) => ((stories.get(id)?.['event'] as number) >= since ? 1 : 0);
  const ranked = [...held].sort(
    ([a, x], [b, y]) => fresh(b) - fresh(a) || y.length - x.length || b - a,
  );
  const out: Sentence[] = [];
  for (const [id, holders] of ranked) {
    if (out.length >= content.annals.say.max) break;
    const story = stories.get(id);
    const def = story && taleDef(content, story['tale'] as string);
    if (!story || !def) continue;
    const bent = (t: EntityRow) => Math.abs((t['level'] as number) - def.truth);
    const by = [...holders].sort((a, b) => bent(b) - bent(a) || a.id - b.id)[0]!;
    const words = {
      name: personName(world, by['person']),
      tale: taleText(content, story, by['level'] as number),
    };
    const lines = [by['line'] as number].filter((l) => l > 0);
    const text = fill(content.annals.say.line, words);
    if (!out.some((o) => o.text === text)) out.push({ section: 'say', text, lines, weight: 0 });
  }
  return out;
}

/** Writes a recap row and its sentences. */
export function writeAnnal(
  world: WorldState,
  fields: { kind: string; year: number; season: number; title: string; head: string; line: number },
  sentences: readonly Sentence[],
): number {
  const annal = addEntity(world, 'annal', { ...fields, tick: world.tick });
  for (const s of sentences)
    addEntity(world, 'annalText', {
      annal,
      section: s.section,
      text: s.text,
      lines: s.lines,
      weight: s.weight,
    });
  return annal;
}

/** The season line written at this turn (the calendar runs first), or the span's opening line:
 * what the numbers cite. */
export function turnLine(world: WorldState, opened: number): number {
  const last = world.log.findLast((e) => e.type === 'calendar.season');
  return last && last.tick === world.tick ? last.id : opened;
}

/** The recap of the season just ended. */
export function writeSeason(ctx: SystemContext): number {
  const { world, content, state } = ctx;
  const clock = clockAt(world.tick - 1, content.calendar);
  const rows = tableOf(world, 'annalLine').filter(
    (r) => r['year'] === clock.year && r['season'] === clock.season,
  );
  const groups = groupsOf(content, rows);
  const sentences = told(content, groups);
  sentences.push(...still(world, content, sentences));
  const opened = state['opened'] ?? 0;
  sentences.push(
    numbersOf(world, content, turnLine(world, opened)),
    ...sayOf(world, content, opened),
  );
  const { head } = headOf(groups, content.annals.titles.quiet);
  const season = content.calendar.seasons[clock.season] ?? '';
  const title = fill(content.annals.titles.season, { season, year: clock.year, title: head });
  const line = turnLine(world, opened);
  return writeAnnal(
    world,
    { kind: 'season', year: clock.year, season: clock.season, title, head, line },
    sentences,
  );
}
