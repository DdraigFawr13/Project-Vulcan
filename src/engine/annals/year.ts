// A year's recap (V-191, 6T review): a paragraph for each season (its title and its weightiest
// sentences), the small troubles that came back season after season folded into one line, the
// year in numbers from the kept lines' tallies, what people say, whose year it was (the person
// named in the most kept lines) and what lies ahead. Its title is its biggest loss or turn. Then
// the year's kept lines go: the recaps hold their words.
import {
  list,
  pronouns,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { personName, personOf, tableOf } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { aheadOf } from './ahead.ts';
import { entryOf } from './collect.ts';
import { markSaid, sayOf } from './say.ts';
import {
  groupsOf,
  headOf,
  heavier,
  turnLine,
  writeAnnal,
  type Group,
  type Sentence,
} from './season.ts';
import { cap, fill, noun, timesOf, type Words } from './words.ts';

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
  const p = personOf(world, who)!;
  const words = {
    name: personName(world, who),
    ...pronouns(p),
    n: theirs.length,
    total: rows.length,
  };
  const lines = theirs.slice(0, content.annals.year.cite).map(lineOf);
  return [{ section: 'whose', text: fill(content.annals.year.whose, words), lines, weight: 0 }];
}

/** The year's title: from the first section in `titleFrom` with a titled kind of `titleMin` or
 * more, its weightiest (a death before a wedding, an attack before a mill); else the weightiest. */
function yearHead(content: EngineContent, groups: readonly Group[]): string {
  const { year, sections, titles } = content.annals;
  const titled = groups.filter((g) => g.def.title !== undefined);
  for (const id of year.titleFrom) {
    const k = sections.findIndex((s) => s.id === id);
    const best = titled
      .filter((g) => g.section === k && g.def.weight >= year.titleMin)
      .sort(heavier)[0];
    if (best) return headOf([best], titles.quietYear);
  }
  return headOf(titled, titles.quietYear);
}

/** The small troubles (with `fold` words) that came back in two seasons or more, as one line. */
function foldedOf(content: EngineContent, groups: readonly Group[]): Sentence[] {
  const { year } = content.annals;
  const back = groups.filter(
    (g) => g.def.fold !== undefined && new Set(g.rows.map((r) => r['season'])).size >= 2,
  );
  if (!back.length) return [];
  const items = back.map((g) =>
    fill(year.foldItem, { what: g.def.fold!, times: timesOf(content, g.rows.length) }),
  );
  const lines = back
    .flatMap((g) => g.rows.slice(0, 2))
    .map(lineOf)
    .slice(0, year.cite);
  return [{ section: 'troubles', text: fill(year.fold, { list: list(items) }), lines, weight: 0 }];
}

/** The recap of the year just ended, written after its winter's; then its kept lines go. `said`
 * holds the levels stories were said at before winter's recap, which the year's stands in for. */
export function writeYear(
  ctx: SystemContext,
  year: number,
  said: ReadonlyMap<number, number>,
): number {
  const { world, content, state } = ctx;
  const rows = tableOf(world, 'annalLine').filter((r) => r['year'] === year);
  const groups = groupsOf(world, content, rows);
  const head = yearHead(content, groups);
  const line = turnLine(world, state['yearOpened'] ?? 0);
  const says = sayOf(world, content, line, said);
  markSaid(world, state, says);
  const last = content.calendar.seasons.length - 1;
  const lastRows = rows.filter((r) => r['season'] === last);
  const sentences = [
    ...seasonsOf(world, content, year),
    ...foldedOf(content, groups),
    numbersOf(content, rows, line),
    ...says,
    ...whoseOf(world, content, rows),
    ...aheadOf(world, content, lastRows, line),
  ];
  const title = fill(content.annals.titles.year, { year, title: head });
  const annal = writeAnnal(
    world,
    { kind: 'year', year, season: last, title, head, line },
    sentences,
  );
  world.entities['annalLine'] = tableOf(world, 'annalLine').filter((r) => r['year'] !== year);
  return annal;
}
