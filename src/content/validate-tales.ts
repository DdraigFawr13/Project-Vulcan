// The tales file's cross-references (src/engine/tales): each tale copies a ledger event type,
// forms a known belief, and starts and forms at levels it has words for; bynames match its levels.
type Files = Readonly<Record<string, unknown>>;

interface Tales {
  beliefs: { id: string }[];
  tales: {
    id: string;
    event: string;
    belief: string;
    truth: number;
    from: number;
    levels: string[];
    bynames?: string[];
  }[];
}

export function checkTales(files: Files): string[] {
  const t = files['tales'] as Tales;
  const events = (files['events'] as { id: string }[]).map((e) => e.id);
  const beliefs = t.beliefs.map((b) => b.id);
  const errors: string[] = [];
  for (const tale of t.tales) {
    const at = `tales.tales[${tale.id}]`;
    if (!events.includes(tale.event)) errors.push(`${at}.event: "${tale.event}" is no event`);
    if (!beliefs.includes(tale.belief)) errors.push(`${at}.belief: "${tale.belief}" is no belief`);
    for (const k of ['truth', 'from'] as const)
      if (tale[k] >= tale.levels.length) errors.push(`${at}.${k}: ${tale[k]} has no words`);
    if (tale.bynames && tale.bynames.length !== tale.levels.length)
      errors.push(`${at}.bynames: one for each of its ${tale.levels.length} levels`);
  }
  return errors;
}
