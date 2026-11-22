// A season's recap (V-191, 6T review): its kept lines grouped by kind, each section's weightiest
// kinds told in the order they first happened (troubles weightiest first, by danger), then who
// leads, the season's numbers, what people say and what lies ahead. Every sentence cites the
// lines it tells; the title is the weightiest titled line's.
import {
  clockAt,
  pronouns,
  type AnnalLineDef,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, alive, personName, personOf, tableOf } from '../entity/index.ts';
import { housesOf } from '../build/index.ts';
import { colonyRow } from '../colony/index.ts';
import { foodDays } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { aheadOf } from './ahead.ts';
import { entryOf } from './collect.ts';
import { markSaid, sayOf } from './say.ts';
import { cap, fill, noun, sentenceOf, type Words } from './words.ts';

export interface Sentence {
  section: string;
  text: string;
  lines: number[];
  weight: number;
}

export interface Group {
  section: number;
  def: AnnalLineDef;
  type: string;
  rows: EntityRow[];
  /** Each row's words, with the pronouns of the person it is about. */
  words: Words[];
}

/** A kept line's words, with he, him and his of the person it is about when it does not say. */
export function wordsOf(world: WorldState, row: EntityRow): Words {
  const words = JSON.parse(row['words'] as string) as Words;
  const p = personOf(world, (row['actors'] as number[])[0]);
  return p ? { ...pronouns(p), ...words } : words;
}

/** The kept lines grouped by the entry that tells them, in the order each kind first happened. */
export function groupsOf(
  world: WorldState,
  content: EngineContent,
  rows: readonly EntityRow[],
): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const type = row['type'] as string;
    const words = wordsOf(world, row);
    const at = entryOf(content, type, words);
    if (!at) continue;
    const key = `${at.section}:${at.line}`;
    const g = groups.get(key);
    if (g) (g.rows.push(row), g.words.push(words));
    else groups.set(key, { section: at.section, def: at.def, type, rows: [row], words: [words] });
  }
  return [...groups.values()];
}

export const heavier = (a: Group, b: Group): number =>
  b.def.weight - a.def.weight || a.rows[0]!.id - b.rows[0]!.id;

/** The bare title: the weightiest titled kind's, from its first line, or `quiet`. */
export function headOf(groups: readonly Group[], quiet: string): string {
  const best = groups.filter((g) => g.def.title !== undefined).sort(heavier)[0];
  return best ? fill(best.def.title!, best.words[0]!) : quiet;
}

/** One sentence a section tells for each of its weightiest `max` kinds, oldest first (weightiest
 * first for a section ordered by `weight`: troubles, by danger to people). */
function told(content: EngineContent, groups: readonly Group[]): Sentence[] {
  const out: Sentence[] = [];
  content.annals.sections.forEach((s, k) => {
    const chosen = groups
      .filter((g) => g.section === k)
      .sort(heavier)
      .slice(0, s.max)
      .sort((a, b) => (s.order === 'weight' ? heavier(a, b) : a.rows[0]!.id - b.rows[0]!.id));
    for (const g of chosen)
      out.push({
        section: s.id,
        text: sentenceOf(content, g.def, g.type, g.words),
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

/** The recap of the season just ended. `said` holds the level each story was last said at. */
export function writeSeason(ctx: SystemContext, said: ReadonlyMap<number, number>): number {
  const { world, content, state } = ctx;
  const clock = clockAt(world.tick - 1, content.calendar);
  const rows = tableOf(world, 'annalLine').filter(
    (r) => r['year'] === clock.year && r['season'] === clock.season,
  );
  const groups = groupsOf(world, content, rows);
  const sentences = told(content, groups);
  sentences.push(...still(world, content, sentences));
  const opened = state['opened'] ?? 0;
  const line = turnLine(world, opened);
  const says = sayOf(world, content, opened, said);
  markSaid(world, state, says);
  sentences.push(numbersOf(world, content, line), ...says, ...aheadOf(world, content, rows, line));
  const head = headOf(groups, content.annals.titles.quiet);
  const season = content.calendar.seasons[clock.season] ?? '';
  const title = fill(content.annals.titles.season, { season, year: clock.year, title: head });
  return writeAnnal(
    world,
    { kind: 'season', year: clock.year, season: clock.season, title, head, line },
    sentences,
  );
}
