// Which drawing a person gets (art step 2, Morgan's Gemini look form 2026-11-20): when the
// `sprites-people` sheet holds whole villagers for their race (`person.<race>.v<n>.<facing>.<frame>`,
// drawn with their own hair and clothes), each person keeps one of them for life, picked from their
// id; otherwise the race's body with tinted clothes and hair overlays, as before. A picture choice,
// never game state.

const VARIANT = /^person\.([a-z-]+)\.v(\d+)\.s\.0$/;

/** How many whole villagers the sheet holds for each race, from its frame names. */
export function variantCounts(frameNames: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of frameNames) {
    const m = VARIANT.exec(name);
    if (m) counts.set(m[1]!, Math.max(counts.get(m[1]!) ?? 0, Number(m[2])));
  }
  return counts;
}

/** The frame-name stem for a person's body (`person.<race>` or `person.<race>.v<n>`) and whether
 * their clothes and hair overlays are drawn over it. */
export function bodyStem(
  counts: ReadonlyMap<string, number>,
  race: string,
  id: number,
): { stem: string; overlays: boolean } {
  const n = counts.get(race) ?? 0;
  if (n === 0) return { stem: `person.${race}`, overlays: true };
  return { stem: `person.${race}.v${(Math.abs(id) % n) + 1}`, overlays: false };
}
