// The recap's small words (V-191): a template filled from a line's data, counts in words, nouns by
// count, and the sentence each kind of kept line makes.
import {
  isName,
  list,
  namesTakeNoThe,
  type AnnalLineDef,
  type EngineContent,
  type Nouns,
} from '../core/index.ts';

export type Words = Readonly<Record<string, string | number | boolean>>;

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `template` with each `{key}` from `words`; `{Key}` takes `key` with a capital. */
export const fill = (template: string, words: Words): string =>
  namesTakeNoThe(template, (k) => isName(words[k])).replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k in words) return String(words[k]);
    const low = k.charAt(0).toLowerCase() + k.slice(1);
    return low in words ? cap(String(words[low])) : '';
  });

/** `n` in words while content has a word for it. */
export const countWord = (content: EngineContent, n: number): string =>
  content.annals.counts[n] ?? String(n);

/** The form of `forms` for count `n`, the last for every larger count. */
const formOf = (content: EngineContent, forms: readonly string[], n: number): string =>
  fill(forms[Math.min(n, forms.length - 1)] ?? '{n}', { n: countWord(content, n) });

/** "twice", "five times": how often, by count. */
export const timesOf = (content: EngineContent, n: number): string =>
  formOf(content, content.annals.times, n);

/** "two houses": `nouns[key]` by `n`. */
export const noun = (content: EngineContent, nouns: Nouns, key: string, n: number): string =>
  formOf(content, nouns[key] ?? ['{n}'], n);

const templates = new WeakMap<EngineContent, Map<string, string>>();

/** The ledger's own words for `type` (events.json). */
function ledgerWords(content: EngineContent, type: string): string {
  let byType = templates.get(content);
  if (!byType)
    templates.set(content, (byType = new Map(content.events.map((e) => [e.id, e.template]))));
  return byType.get(type) ?? '';
}

/** An item mid-sentence: a leading "The" or "A" goes small, names keep their capital. */
export const midSentence = (s: string): string => s.replace(/^(The|A|An) /, (w) => w.toLowerCase());

/** The items said as a list: each once, with how often when it repeats, then how many more. */
function itemsOf(content: EngineContent, items: readonly string[]): string {
  const { annals } = content;
  const counted = new Map<string, number>();
  for (const i of items) counted.set(i, (counted.get(i) ?? 0) + 1);
  const said = [...counted].map(([item, n]) =>
    n > 1 ? fill(annals.repeat, { item, times: formOf(content, annals.times, n) }) : item,
  );
  if (said.length <= annals.listMax) return list(said);
  const more = fill(annals.more, { n: countWord(content, said.length - annals.listMax) });
  return list([...said.slice(0, annals.listMax), more]);
}

/** The sentence a group of kept lines of one kind makes: its own, or the `many` one with its items
 * said as a list. */
export function sentenceOf(
  content: EngineContent,
  def: AnnalLineDef,
  type: string,
  lines: readonly Words[],
): string {
  if (lines.length > 1 && def.many !== undefined) {
    const items = lines.map((w) => midSentence(fill(def.item ?? '', w)));
    const n = countWord(content, lines.length);
    const times = formOf(content, content.annals.times, lines.length);
    return fill(def.many, {
      count: n,
      Count: cap(n),
      times,
      Times: cap(times),
      list: itemsOf(content, items),
    });
  }
  const one = def.one ?? ledgerWords(content, type);
  return [...new Set(lines.map((w) => fill(one, w).trim()))].join(' ');
}
