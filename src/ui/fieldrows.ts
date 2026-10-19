// A field tile's page (P4.7): crop, size, harvest, seed, frost, who is at it and why the colony
// laid it out there, then the lines behind it. Every value is words from the worker; nothing
// here decides a rule (GAME-02) or picks a tile or a person (V-049).
import type { LedgerLine, TileView } from '../worker/index.ts';

const LABELS: Readonly<Record<string, string>> = {
  'field.sown': 'Sown · ',
  'field.ripe': 'Ripe · ',
  'field.harvested': 'Harvested · ',
  'field.frostKilled': 'Frost · ',
};

/** The tile page's rows for a field, key and value. */
export function fieldFacts(tile: TileView): [string, string][] {
  const { field } = tile;
  if (!field) return [];
  return [
    ['crop', field.crop],
    ['field', field.size],
    ['why here', field.why],
    ['harvest', field.harvest],
    ['seed', field.seed],
    ['frost', field.frost],
    ...(field.here ? [['here', field.here] as [string, string]] : []),
  ];
}

/** The lines behind a field with their labels, newest first. */
export function fieldLines(tile: TileView): [LedgerLine, string][] {
  const { field } = tile;
  if (!field) return [];
  return [
    ...(field.last ? [[field.last, LABELS[field.last.type] ?? 'Latest · '] as const] : []),
    ...(field.took ? [[field.took, 'Taken up · '] as const] : []),
    ...(field.sited ? [[field.sited, 'Laid out · '] as const] : []),
  ].map(([l, label]) => [l, label]);
}
