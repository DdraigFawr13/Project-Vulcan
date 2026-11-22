// Small words every system's ledger lines and views share: a list said aloud, and an item's name.
import type { EngineContent, EntityRow } from './types.ts';

/** "a", "a and b", "a, b and c". */
export const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** An item's name from content, or its id when content has no entry for it. */
export const itemName = (content: EngineContent, id: string): string =>
  content.items.find((i) => i.id === id)?.name ?? id;

/** The same words with a small first letter, to go mid-sentence. */
export const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** Whether `word` already reads as named: a possessive name ("Aldith's home", "Deirdre and
 * Ciaran's home") or one that brings its own article ("The Plough"). "Rations law" is not. */
const owned = (word: string): boolean => /^(The |[A-Z][\w-]*(?: and [A-Z][\w-]*)?'s )/.test(word);

/** "the cottage", but "Aldith's home" or "The Plough": such a name takes no "the" (6T review). */
export const the = (word: string): string => (owned(word) ? word : `the ${word}`);

/** `template` with "the {key}" cut to "{key}" where `named(key)` says the slot holds such a name,
 * so a filled line reads "in Aldith's home", not "in the Aldith's home". */
export const namesTakeNoThe = (template: string, named: (key: string) => boolean): string =>
  template.replace(/\b[Tt]he \{(\w+)\}/g, (all, key: string) => (named(key) ? `{${key}}` : all));

/** Whether a slot's value is a name that takes no "the". */
export const isName = (value: unknown): boolean => typeof value === 'string' && owned(value);

/** He, him, his for `m`; she, her, her otherwise. */
export function pronouns(p: EntityRow): { they: string; them: string; their: string } {
  return p['sex'] === 'm'
    ? { they: 'he', them: 'him', their: 'his' }
    : { they: 'she', them: 'her', their: 'her' };
}
