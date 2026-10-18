// The shape of every forked content file (src/content/data/<file>.json), one spec per file.
// References name the file whose ids they must match; validate.ts resolves them.
import { CLIMATE_SCHEMAS } from './schemas-climate';
import { PEOPLE_SCHEMAS } from './schemas-people';
import { REGION_SCHEMAS } from './schemas-region';
import { WORLD_SCHEMAS } from './schemas-world';

export const SCHEMAS = {
  ...WORLD_SCHEMAS,
  ...CLIMATE_SCHEMAS,
  ...PEOPLE_SCHEMAS,
  ...REGION_SCHEMAS,
};

export type ContentFile = keyof typeof SCHEMAS;
