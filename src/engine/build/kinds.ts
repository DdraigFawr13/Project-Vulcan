// The kinds of building the Build sheet has a row for (V-049), and the content each row reads.
import type { EngineContent } from '../core/index.ts';

export const HOUSE_KIND = 'house';
export const FIELD_KIND = 'field';
export const SMITHY_KIND = 'smithy';
export const PASTURE_KIND = 'pasture';
export const ROAD_KIND = 'road';
export const PITS_KIND = 'pits';
export const TAVERN_KIND = 'tavern';
export const SCHOOL_KIND = 'school';
export const TITHE_KIND = 'tithe';
/** A Build sheet row's name and start level. */
export function sheetDef(content: EngineContent, kind: string): { name: string; start: number } {
  const rows: Record<string, { name: string; start: number }> = {
    [PASTURE_KIND]: content.flock.pasture,
    [TAVERN_KIND]: content.tavern.build,
    [SCHOOL_KIND]: content.teach.school.build,
    [TITHE_KIND]: content.lord.tithe.barn,
    [PITS_KIND]: content.clothes.pits,
    [FIELD_KIND]: content.buildings.field,
    [SMITHY_KIND]: content.buildings.smithy,
    [ROAD_KIND]: content.buildings.roads,
  };
  return rows[kind] ?? content.buildings.house;
}

/** Every kind `setBuild` takes. */
export const BUILD_KINDS: readonly string[] = [
  HOUSE_KIND,
  FIELD_KIND,
  SMITHY_KIND,
  PASTURE_KIND,
  ROAD_KIND,
  PITS_KIND,
  TAVERN_KIND,
  SCHOOL_KIND,
  TITHE_KIND,
];
