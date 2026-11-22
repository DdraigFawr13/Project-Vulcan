// What people say (V-191, 6T review P2): the most-held tales, each told in the teller's own words
// (a teller of their own story says "I", "me", "my"), and a tale comes back in a later recap only
// when the version told has changed since. When two people hold the same story at different
// levels, both tellings stand side by side: that gap is where the story is.
import type { EngineContent, EntityRow, SelfWords, WorldState } from '../core/index.ts';
import { personOf, tableOf } from '../entity/index.ts';
import { taleDef, taleText } from '../tales/index.ts';
import type { Sentence } from './season.ts';
import { cap, fill } from './words.ts';

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` as `name` tells it of themselves: their name as I (the subject), me or my, with the verb
 * after I agreeing and their own he/she words as mine. Unchanged when it does not name them. */
export function firstPerson(text: string, name: string, self: SelfWords): string {
  if (!name || !new RegExp(`\\b${escape(name)}\\b`).test(text)) return text;
  const n = escape(name);
  let subject = false;
  const asI = (pre: string, verb: string) => {
    subject = true;
    return `${pre}${self.I} ${self.verbs[verb] ?? verb}`;
  };
  let t = text
    // "Name and Bryn had words", "Bryn and Name had words": the pair is the subject.
    .replace(new RegExp(`^${n} and ([A-Z][\\w']*)`), `$1 and ${self.I}`)
    .replace(new RegExp(`^([A-Z][\\w']*) and ${n}\\b`), `$1 and ${self.I}`)
    // Their name first, or after "say": they are the subject.
    .replace(new RegExp(`(^|\\bsay )${n} (\\w+)`), (_, pre: string, verb: string) => asI(pre, verb))
    .replace(new RegExp(`\\b${n}'s\\b`, 'g'), (_, at: number) =>
      at === 0 ? cap(self.my) : self.my,
    )
    .replace(new RegExp(`\\b${n}, who `, 'g'), `${self.me}${self.who}`)
    .replace(new RegExp(`\\b${n}\\b`, 'g'), self.me);
  if (subject) t = t.replace(/\b[a-z]+\b/g, (w) => self.own[w] ?? w);
  return t;
}

/** The state key that holds the level a story was last said at, plus one. */
const saidKey = (story: number): string => `said${story}`;

/** The levels stories were last said at, from the system's state. */
export function saidOf(state: Readonly<Record<string, number>>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [k, v] of Object.entries(state)) {
    const m = /^said(\d+)$/.exec(k);
    if (m) out.set(Number(m[1]), v - 1);
  }
  return out;
}

/** Notes each story said at its level, and forgets the marks of stories nobody holds now. */
export function markSaid(
  world: WorldState,
  state: Record<string, number>,
  said: readonly { story: number; level: number }[],
): void {
  const stories = new Set(tableOf(world, 'story').map((s) => s.id));
  for (const [story] of saidOf(state)) if (!stories.has(story)) delete state[saidKey(story)];
  for (const s of said) state[saidKey(s.story)] = s.level + 1;
}

export interface Said extends Sentence {
  story: number;
  level: number;
}

const nameOf = (world: WorldState, t: EntityRow): string =>
  (personOf(world, t['person'])?.['name'] as string | undefined) ?? '';

/** One story's sentence: the most bent telling, and beside it the one farthest from it, when two
 * holders tell it differently. */
function sayStory(
  world: WorldState,
  content: EngineContent,
  story: EntityRow,
  holders: readonly EntityRow[],
): Said | undefined {
  const def = taleDef(content, story['tale'] as string);
  if (!def) return undefined;
  const { say } = content.annals;
  const level = (t: EntityRow) => t['level'] as number;
  const bent = (t: EntityRow) => Math.abs(level(t) - def.truth);
  const by = [...holders].sort((a, b) => bent(b) - bent(a) || a.id - b.id)[0]!;
  const far = (t: EntityRow) => Math.abs(level(t) - level(by));
  const other = [...holders].sort((a, b) => far(b) - far(a) || bent(a) - bent(b) || a.id - b.id)[0];
  const told = (t: EntityRow) =>
    firstPerson(taleText(content, story, level(t)), nameOf(world, t), say.self);
  const words = { name: nameOf(world, by), tale: told(by) };
  const lines = [by['line'] as number];
  let text = fill(say.line, words);
  if (other && level(other) !== level(by) && told(other) !== words.tale) {
    text = fill(say.both, { ...words, other: nameOf(world, other), told: told(other) });
    lines.push(other['line'] as number);
  }
  const cited = lines.filter((l) => l > 0);
  return { section: 'say', text, lines: cited, weight: 0, story: story.id, level: level(by) };
}

/** What people say: the most-held tales of what happened since line `since` (then older ones),
 * newest story first on a tie, leaving out any said before at the same level (`said`). */
export function sayOf(
  world: WorldState,
  content: EngineContent,
  since: number,
  said: ReadonlyMap<number, number>,
): Said[] {
  const stories = new Map(tableOf(world, 'story').map((s) => [s.id, s]));
  const held = new Map<number, EntityRow[]>();
  for (const t of tableOf(world, 'tale')) {
    const s = t['story'] as number;
    held.set(s, [...(held.get(s) ?? []), t]);
  }
  const fresh = (id: number) => ((stories.get(id)?.['event'] as number) >= since ? 1 : 0);
  const ranked = [...held].sort(
    ([a, x], [b, y]) => fresh(b) - fresh(a) || y.length - x.length || b - a,
  );
  const out: Said[] = [];
  for (const [id, holders] of ranked) {
    if (out.length >= content.annals.say.max) break;
    const story = stories.get(id);
    const s = story && sayStory(world, content, story, holders);
    if (!s || said.get(id) === s.level || out.some((o) => o.text === s.text)) continue;
    out.push(s);
  }
  return out;
}
