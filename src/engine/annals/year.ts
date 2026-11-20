// A year's recap (V-191): a paragraph for each season (its title and its weightiest sentences),
// the year in numbers from the kept lines' tallies, what people say, and whose year it was (the
// person named in the most kept lines). Then the year's kept lines go: the recaps hold their words.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { personName, personOf, tableOf } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { entryOf } from './collect.ts';
import { groupsOf, headOf, sayOf, turnLine, writeAnnal, type Sentence } from './season.ts';
import { cap, fill, noun, type Words } from './words.ts';

const lineOf = (r: EntityRow) => r['event'] as number;

/** Each season's paragraph: its title, then its `perSeason` weightiest sentences in order. */
function seasonsOf(world: WorldState, content: EngineContent, year: number): Sentence[] {
  const { perSeason } = content.annals.year;
  const texts = tableOf(world, 'annalText');
  const out: Sentence[] = [];
  for (const a of tableOf(world, 'annal')) {
    if (a['kind'] !== 'season' || a['year'] !== year) continue;
    const season = content.calendar.seasons[a['season'] as number] ?? '';
    const own = texts.filter((t) => t['annal'] === a.id && (t['weight'] as number) > 0);
    const best = [...own]
      .sort((x, y) => (y['weight'] as number) - (x['weight'] as number) || x.id - y.id)
      .slice(0, perSeason)
      .sort((x, y) => x.id - y.id);
    const head = fill(content.annals.year.season, {
      Season: cap(season),
      title: a['head'] as string,
    });
    const text = [head, ...best.map((t) => t['text'] as string)].join(' ');
    const lines = [a['line'] as number, ...best.flatMap((t) => t['lines'] as number[])].filter(
      (l) => l > 0,
    );
    const weight = Math.max(0, ...best.map((t) => t['weight'] as number));
    out.push({ section: season, text, lines, weight });
  }
  return out;
}

/** The year's tallies: who came, died and was born, and houses built. */
function numbersOf(content: EngineContent, rows: readonly EntityRow[], line: number): Sentence {
  const tally: Record<string, number> = { came: 0, died: 0, born: 0, homes: 0 };
  for (const r of rows) {
    const words = JSON.parse(r['words'] as string) as Words;
    const def = entryOf(content, r['type'] as string, words)?.def;
    if (!def?.tally) continue;
    const names = String(words['names'] ?? '')
      .split(/, | and /)
      .filter(Boolean).length;
    const per = def.per ?? 'line';
    const by = per === 'actors' ? (r['actors'] as number[]).length : per === 'names' ? names : 1;
    tally[def.tally] = (tally[def.tally] ?? 0) + Math.max(1, by);
  }
  const { year } = content.annals;
  const words = Object.fromEntries(
    Object.entries(tally).map(([k, v]) => [k, noun(content, year.nouns, k, v)]),
  );
  return {
    section: 'numbers',
    text: fill(year.numbers, words),
    lines: line ? [line] : [],
    weight: 0,
  };
}

/** Whose year it was: the person named in the most kept lines, the first named on a tie. */
function whoseOf(
  world: WorldState,
  content: EngineContent,
  rows: readonly EntityRow[],
): Sentence[] {
  const named = new Map<number, EntityRow[]>();
  for (const r of rows)
    for (const a of new Set(r['actors'] as number[]))
      if (personOf(world, a)) named.set(a, [...(named.get(a) ?? []), r]);
  let best: [number, EntityRow[]] | undefined;
  for (const entry of named) if (!best || entry[1].length > best[1].length) best = entry;
  if (!best) return [];
  const [who, theirs] = best;
  const words = { name: personName(world, who), n: theirs.length, total: rows.length };
  const lines = theirs.slice(0, content.annals.year.cite).map(lineOf);
  return [{ section: 'whose', text: fill(content.annals.year.whose, words), lines, weight: 0 }];
}

/** The recap of the year just ended, written after its winter's; then its kept lines go. */
export function writeYear(ctx: SystemContext, year: number): number {
  const { world, content, state } = ctx;
  const rows = tableOf(world, 'annalLine').filter((r) => r['year'] === year);
  const { head } = headOf(groupsOf(content, rows), content.annals.titles.quietYear);
  const line = state['yearOpened'] ?? 0;
  const sentences = [
    ...seasonsOf(world, content, year),
    numbersOf(content, rows, turnLine(world, line)),
    ...sayOf(world, content, line),
    ...whoseOf(world, content, rows),
  ];
  const title = fill(content.annals.titles.year, { year, title: head });
  const last = content.calendar.seasons.length - 1;
  const annal = writeAnnal(
    world,
    { kind: 'year', year, season: last, title, head, line },
    sentences,
  );
  world.entities['annalLine'] = tableOf(world, 'annalLine').filter((r) => r['year'] !== year);
  return annal;
}
