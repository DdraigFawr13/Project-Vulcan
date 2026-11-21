// Song titles (6B Bundle 5 follow-up): a tale's `song` lists title templates; one is chosen for
// each new song from the world's seed and the story, so a seed always names its songs alike.
// A template is filled from the story's words plus `one` (who it is about), `month` and `year`
// (the ordinal word of the colony's year the event fell in); a capitalised key gives a capitalised
// word ("{Dish}"). A template with a word the story lacks is never chosen, nor a title the colony
// already sings, while another remains.
import { clockAt, hashString, type EntityRow } from '../core/index.ts';
import { recordOf } from '../log/index.ts';
import type { SystemContext } from '../sim/index.ts';

type Ctx = Pick<SystemContext, 'world' | 'content'>;
import { fillWords } from './tables.ts';

/** The words a title may use: the story's own, then who, when and the year. */
function wordsOf(ctx: Ctx, story: EntityRow): Record<string, string> {
  const { world, content } = ctx;
  const own = JSON.parse(story['words'] as string) as Record<string, string | number>;
  const about = (world.entities['person'] ?? []).find((p) => p.id === story['about']);
  const tick = recordOf(world, story['event'] as number)?.tick ?? world.tick;
  const at = clockAt(tick, content.calendar);
  const words: Record<string, string> = {
    ...(about ? { one: about['name'] as string } : {}),
    month: content.calendar.monthNames[at.month] ?? '',
    year: content.tales.ordinals[at.year - 1] ?? '',
  };
  for (const [k, v] of Object.entries(own)) words[k] = String(v);
  return words;
}

const KEY = /\{(\w+)\}/g;
const SMALL = new Set(['a', 'and', 'at', 'by', 'in', 'of', 'on', 'round', 'the', 'to']);
/** "loaves of bread" -> "Loaves of Bread": each word capitalised but the small ones, unless the
 * word opens the title. */
const cap = (w: string, first: boolean) =>
  w
    .split(' ')
    .map((x, i) => ((i || !first) && SMALL.has(x) ? x : x.charAt(0).toUpperCase() + x.slice(1)))
    .join(' ');

/** `text` filled from `words`; undefined when a word it needs is missing or empty. */
function fill(text: string, words: Record<string, string>): string | undefined {
  let ok = true;
  const out = text.replace(KEY, (_, k: string, at: number) => {
    const w =
      words[k] ??
      (words[k.toLowerCase()] !== undefined ? cap(words[k.toLowerCase()]!, at === 0) : '');
    if (!w) ok = false;
    return w;
  });
  return ok ? out : undefined;
}

/** The title of a new song of `story` from `templates`, chosen by the seed and the story. */
export function songTitle(
  ctx: Ctx,
  story: EntityRow,
  templates: readonly string[],
  taken: ReadonlySet<string>,
): string {
  const words = wordsOf(ctx, story);
  const all = templates.map((t) => fill(t, words)).filter((t): t is string => !!t);
  const fresh = all.filter((t) => !taken.has(t));
  const from = fresh.length ? fresh : all;
  if (!from.length) return fillWords(story, templates[0] ?? '');
  return from[hashString(`${ctx.world.seed}:song:${story.id}`) % from.length]!;
}
