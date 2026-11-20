// Bynames (6B Bundle 5, P6.12, V-188): once a day, a tale about a living person that more than
// `byname.share` per cent of the grown-ups hold, told at least `byname.told` times, gives them the
// byname of the version most hold (tales.json `bynames`, "" for none). One for life, the first
// only; a song can give one too (songs.ts). It is a `tale.byname` line citing the tale's latest
// telling, and `byname-proud` or `byname-stung` (by `byname.proud`), felt again on hearing it.
import type { EntityRow } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bynameOf, storiesOf, taleDef, taleText } from './tables.ts';

const PROUD = 'byname-proud';
const STUNG = 'byname-stung';

/** The memory a byname leaves: proud or stung. */
const feeling = (ctx: SystemContext, word: string): string =>
  ctx.content.tales.byname.proud.includes(word) ? PROUD : STUNG;

/** The newest line anyone heard `story` by (a telling or a song), else the event itself. */
function latestTelling(ctx: SystemContext, story: EntityRow): number {
  const lines = (ctx.world.entities['tale'] ?? [])
    .filter((t) => t['story'] === story.id && t['teller'] !== 0)
    .map((t) => t['line'] as number);
  return lines.length ? Math.max(...lines) : (story['event'] as number);
}

/** `person` is called `word` from now on, for `story` told at `level`, because of line `cause`. */
export function giveByname(
  ctx: SystemContext,
  person: EntityRow,
  word: string,
  story: EntityRow,
  level: number,
  cause: number,
): void {
  const line = ctx.emit('tale.byname', {
    causes: [cause],
    actors: [person.id],
    data: { name: person['name'] as string, word, tale: taleText(ctx.content, story, level) },
  });
  addEntity(ctx.world, 'byname', { person: person.id, word, story: story.id, line });
  addMemory(ctx, person.id, feeling(ctx, word), line);
}

/** The byname `level` of `story` would give, if its person is alive and has none yet. */
export function bynameFor(
  ctx: SystemContext,
  story: EntityRow,
  level: number,
): { person: EntityRow; word: string } | undefined {
  const { world, content } = ctx;
  const word = taleDef(content, story['tale'] as string)?.bynames?.[level] ?? '';
  const person = (world.entities['person'] ?? []).find((p) => p.id === story['about']);
  if (!word || !person || person['status'] !== 'alive' || bynameOf(world, person.id)) return;
  return { person, word };
}

/** The level most holders hold, the worse on a tie. */
function mostHeld(tales: readonly EntityRow[]): number {
  const counts = new Map<number, number>();
  for (const t of tales)
    counts.set(t['level'] as number, (counts.get(t['level'] as number) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
}

/** Daily: each tale about someone held widely enough and told often enough names them. */
export function bynames(ctx: SystemContext): void {
  const { world, content } = ctx;
  const rule = content.tales.byname;
  const grownUps = new Set(
    (world.entities['person'] ?? [])
      .filter((p) => p['status'] === 'alive' && !p['stranger'] && grown(world, content, p))
      .map((p) => p.id),
  );
  for (const story of storiesOf(world)) {
    if ((story['told'] as number) < rule.told || !story['about']) continue;
    const held = (world.entities['tale'] ?? []).filter(
      (t) => t['story'] === story.id && grownUps.has(t['person'] as number),
    );
    if (held.length * 100 <= rule.share * grownUps.size) continue;
    const level = mostHeld(held);
    const named = bynameFor(ctx, story, level);
    if (named) giveByname(ctx, named.person, named.word, story, level, latestTelling(ctx, story));
  }
}

/** On hearing the tale that named them, the named feel it again. */
export function feltAgain(ctx: SystemContext, person: number, story: number, line: number): void {
  const b = bynameOf(ctx.world, person);
  if (b && b['story'] === story) addMemory(ctx, person, feeling(ctx, b['word'] as string), line);
}
