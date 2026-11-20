// The kinds of building the Build sheet has a row for (V-049), and the content each row reads.
import type { EngineContent } from '../core/index.ts';

export const HOUSE_KIND = 'house';
export const FIELD_KIND = 'field';
export const SMITHY_KIND = 'smithy';
export const PASTURE_KIND = 'pasture';
export const ROAD_KIND = 'road';
export const PITS_KIND = 'pits';
export const TAVERN_KIND = 'tavern';
export const sheetDef = (content: EngineContent, kind: string) =>
  kind === PASTURE_KIND
    ? content.flock.pasture
    : kind === TAVERN_KIND
      ? content.tavern.build
      : kind === PITS_KIND
        ? content.clothes.pits
        : content.buildings[
            kind === FIELD_KIND
              ? 'field'
              : kind === SMITHY_KIND
                ? 'smithy'
                : kind === ROAD_KIND
                  ? 'roads'
                  : 'house'
          ];

/** Every kind `setBuild` takes. */
export const BUILD_KINDS: readonly string[] = [
  HOUSE_KIND,
  FIELD_KIND,
  SMITHY_KIND,
  PASTURE_KIND,
  ROAD_KIND,
  PITS_KIND,
  TAVERN_KIND,
];
