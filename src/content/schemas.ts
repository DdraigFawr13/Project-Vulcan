// The shape of every forked content file (src/content/data/<file>.json), one spec per file.
// References name the file whose ids they must match; validate.ts resolves them.
import { CLIMATE_SCHEMAS } from './schemas-climate';
import { GROUND_SCHEMAS } from './schemas-ground';
import { LAWS_SCHEMAS } from './schemas-laws';
import { LIFE_SCHEMAS } from './schemas-life';
import { METAL_SCHEMAS } from './schemas-metal';
import { PEOPLE_SCHEMAS } from './schemas-people';
import { REGION_SCHEMAS } from './schemas-region';
import { TOOLS_SCHEMAS } from './schemas-tools';
import { WILD_SCHEMAS } from './schemas-wild';
import { WORLD_SCHEMAS } from './schemas-world';

export const SCHEMAS = {
  ...WORLD_SCHEMAS,
  ...GROUND_SCHEMAS,
  ...LIFE_SCHEMAS,
  ...LAWS_SCHEMAS,
  ...METAL_SCHEMAS,
  ...CLIMATE_SCHEMAS,
  ...PEOPLE_SCHEMAS,
  ...REGION_SCHEMAS,
  ...TOOLS_SCHEMAS,
  ...WILD_SCHEMAS,
};

export type ContentFile = keyof typeof SCHEMAS;
