// Checks the stop kinds (Phase 6T, V-191): every notable event names a known kind in `stop`, and
// no other event has one, so the What stops play sheet covers every alert.
type Files = Readonly<Record<string, unknown>>;

interface EventEntry {
  id?: unknown;
  stop?: unknown;
  notable?: unknown;
}

export function checkStops(files: Files): string[] {
  const kinds = new Set(
    (Array.isArray(files['stops']) ? (files['stops'] as { id?: unknown }[]) : []).map((s) => s.id),
  );
  const events = Array.isArray(files['events']) ? (files['events'] as EventEntry[]) : [];
  const errors: string[] = [];
  if (kinds.size !== (files['stops'] as unknown[] | undefined)?.length)
    errors.push('stops: a kind is missing its id or appears twice');
  for (const e of events) {
    const at = `events[${String(e.id)}]`;
    if (e.notable !== undefined && e.stop === undefined)
      errors.push(`${at}: a notable event needs a stop kind`);
    else if (e.notable === undefined && e.stop !== undefined)
      errors.push(`${at}: only a notable event has a stop kind`);
    else if (e.stop !== undefined && !kinds.has(e.stop))
      errors.push(`${at}.stop: "${String(e.stop)}" is not in stops`);
  }
  return errors;
}
