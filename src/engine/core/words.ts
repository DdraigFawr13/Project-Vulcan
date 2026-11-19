// Small words every system's ledger lines and views share: a list said aloud, and an item's name.
import type { EngineContent } from './types.ts';

/** "a", "a and b", "a, b and c". */
export const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** An item's name from content, or its id when content has no entry for it. */
export const itemName = (content: EngineContent, id: string): string =>
  content.items.find((i) => i.id === id)?.name ?? id;
