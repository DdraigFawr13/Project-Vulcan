// Checks the dice seed words in region.json (6W Slice 1).
type Files = Readonly<Record<string, unknown>>;

/** The dice seed words (6W Slice 1): lower-case letters only, so a seed reads as two words joined
 * by one hyphen, and no word twice in a list, so every pair is a different seed. */
export function checkSeedWords(files: Files): string[] {
  const words = (files['region'] as { seedWords?: Record<string, unknown> } | undefined)?.seedWords;
  const errors: string[] = [];
  for (const side of ['first', 'second'] as const) {
    const list = Array.isArray(words?.[side]) ? (words[side] as unknown[]) : [];
    if (!list.length) errors.push(`region.seedWords.${side}: no words`);
    const seen = new Set<unknown>();
    for (const w of list) {
      if (typeof w !== 'string' || !/^[a-z]+$/.test(w))
        errors.push(`region.seedWords.${side}: "${String(w)}" is not one lower-case word`);
      if (seen.has(w)) errors.push(`region.seedWords.${side}: "${String(w)}" appears twice`);
      seen.add(w);
    }
  }
  return errors;
}
