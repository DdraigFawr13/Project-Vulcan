// The shape of every forked content file (src/content/data/<file>.json), one spec per file.
// References name the file whose ids they must match; validate.ts resolves them.
import { CLIMATE_SCHEMAS } from './schemas-climate';
import { CLOTHES_SCHEMAS } from './schemas-clothes';
import { GROUND_SCHEMAS } from './schemas-ground';
import { HEALTH_SCHEMAS } from './schemas-health';
import { LAMP_SCHEMAS } from './schemas-lamp';
import { LAWS_SCHEMAS } from './schemas-laws';
import { LIFE_SCHEMAS } from './schemas-life';
import { FLOCK_SCHEMAS } from './schemas-flock';
import { METAL_SCHEMAS } from './schemas-metal';
import { PEOPLE_SCHEMAS } from './schemas-people';
import { REGION_SCHEMAS } from './schemas-region';
import { STRANGERS_SCHEMAS } from './schemas-strangers';
import { TOOLS_SCHEMAS } from './schemas-tools';
import { WILD_SCHEMAS } from './schemas-wild';
import { WORLD_SCHEMAS } from './schemas-world';

export const SCHEMAS = {
  ...WORLD_SCHEMAS,
  ...GROUND_SCHEMAS,
  ...LIFE_SCHEMAS,
  ...LAWS_SCHEMAS,
  ...HEALTH_SCHEMAS,
  ...METAL_SCHEMAS,
  ...CLIMATE_SCHEMAS,
  ...PEOPLE_SCHEMAS,
  ...REGION_SCHEMAS,
  ...TOOLS_SCHEMAS,
  ...WILD_SCHEMAS,
  ...FLOCK_SCHEMAS,
  ...STRANGERS_SCHEMAS,
  ...LAMP_SCHEMAS,
  ...CLOTHES_SCHEMAS,
};

export type ContentFile = keyof typeof SCHEMAS;
