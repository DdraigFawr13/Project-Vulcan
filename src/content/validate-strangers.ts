// The strangers file's cross-references (split from validate.ts).
type Files = Readonly<Record<string, unknown>>;

// Strangers (src/engine/band/strangers.ts): every month named is a calendar month, every reason
// a kind, the animals flock species and the law a law.
export function checkStrangers(files: Files): string[] {
  const f = files['strangers'] as {
    draw: { first: { month: string } };
    weigh: { harvest: string };
    reasons: Record<string, string>;
    kinds: { id: string }[];
    animals: string[];
    law: string;
  };
  const months = (files['calendar'] as { monthNames: string[] }).monthNames;
  const species = (files['flock'] as { kinds: { species: string }[] }).kinds.map((k) => k.species);
  const laws = (files['laws'] as { laws: { id: string }[] }).laws.map((l) => l.id);
  const errors: string[] = [];
  for (const [at, m] of [
    ['draw.first.month', f.draw.first.month],
    ['weigh.harvest', f.weigh.harvest],
  ])
    if (!months.includes(m!)) errors.push(`strangers.${at}: "${m}" is no month`);
  for (const [k, kind] of Object.entries(f.reasons))
    if (!f.kinds.some((d) => d.id === kind))
      errors.push(`strangers.reasons.${k}: no kind "${kind}"`);
  if (!f.kinds.some((d) => d.id === 'wander')) errors.push('strangers.kinds: no "wander"');
  for (const a of f.animals)
    if (!species.includes(a)) errors.push(`strangers.animals: "${a}" is no flock species`);
  if (!laws.includes(f.law)) errors.push(`strangers.law: "${f.law}" is no law`);
  return errors;
}
