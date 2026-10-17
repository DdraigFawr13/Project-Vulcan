// The shape of every forked content file (src/content/data/<file>.json), one spec per file.
// References name the file whose ids they must match; validate.ts resolves them.
import { PEOPLE_SCHEMAS } from './schemas-people';
import { WORLD_SCHEMAS } from './schemas-world';

export const SCHEMAS = { ...WORLD_SCHEMAS, ...PEOPLE_SCHEMAS };

export type ContentFile = keyof typeof SCHEMAS;
