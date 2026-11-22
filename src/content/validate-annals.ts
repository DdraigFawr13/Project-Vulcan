// The annals file's cross-references (src/engine/annals, V-191): every section line names a ledger
// event, a joined sentence has its item words, and every kept line (importance 3, or notable) is
// told by a section or skipped on purpose, so a new event joins the recaps or is left out by name.
type Files = Readonly<Record<string, unknown>>;

interface Annals {
  skip: string[];
  sections: { id: string; lines: { event: string; many?: string; item?: string }[] }[];
  page: { heads: Record<string, string> };
  year: { titleFrom: string[] };
}
interface EventDef {
  id: string;
  importance: number;
  notable?: Record<string, string>;
}

export function checkAnnals(files: Files): string[] {
  const a = files['annals'] as Annals;
  const events = files['events'] as EventDef[];
  const ids = new Set(events.map((e) => e.id));
  const told = new Set<string>();
  const errors: string[] = [];
  for (const s of a.sections)
    for (const line of s.lines) {
      const at = `annals.sections[${s.id}].lines[${line.event}]`;
      if (!ids.has(line.event)) errors.push(`${at}: "${line.event}" is no event`);
      if (line.many !== undefined && line.item === undefined) errors.push(`${at}: many needs item`);
      told.add(line.event);
    }
  // The engine adds the elder to `leads` when no line says who leads.
  if (!a.sections.some((s) => s.id === 'leads')) errors.push('annals.sections: no "leads"');
  errors.push(...headsMissing(a));
  errors.push(...titleFromMissing(a));
  for (const id of a.skip) if (!ids.has(id)) errors.push(`annals.skip: "${id}" is no event`);
  for (const e of events)
    if ((e.importance === 3 || e.notable) && !told.has(e.id) && !a.skip.includes(e.id))
      errors.push(`annals: kept line "${e.id}" is in no section and not in skip`);
  return errors;
}

/** Every section a season's or year's recap writes has a heading on the page (slice 3). */
const headsMissing = (a: Annals): string[] =>
  [...a.sections.map((s) => s.id), 'numbers', 'ahead', 'say', 'whose']
    .filter((id) => !a.page.heads[id])
    .map((id) => `annals.page.heads: no heading for "${id}"`);

/** Every section the year's title is taken from is a section (V-204). */
const titleFromMissing = (a: Annals): string[] =>
  a.year.titleFrom
    .filter((id) => !a.sections.some((s) => s.id === id))
    .map((id) => `annals.year.titleFrom: "${id}" is no section`);
