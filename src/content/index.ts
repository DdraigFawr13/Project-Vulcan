// The content layer's public surface: the forked Story Generator data, checked once on load,
// and its fingerprint. Read the shapes in schemas.ts, not the data files (MODULE.md).
import abilities from './data/abilities.json';
import ailments from './data/ailments.json';
import awakenings from './data/awakenings.json';
import biomes from './data/biomes.json';
import calendar from './data/calendar.json';
import conditions from './data/conditions.json';
import creatures from './data/creatures.json';
import cultures from './data/cultures.json';
import diseases from './data/diseases.json';
import dragons from './data/dragons.json';
import events from './data/events.json';
import faiths from './data/faiths.json';
import features from './data/features.json';
import greatWorks from './data/great-works.json';
import items from './data/items.json';
import jobs from './data/jobs.json';
import lore from './data/lore.json';
import memories from './data/memories.json';
import names from './data/names.json';
import needs from './data/needs.json';
import races from './data/races.json';
import region from './data/region.json';
import resources from './data/resources.json';
import schools from './data/schools.json';
import seasons from './data/seasons.json';
import terrain from './data/terrain.json';
import tiers from './data/tiers.json';
import traits from './data/traits.json';
import weather from './data/weather.json';
import type { Infer } from './schema';
import { SCHEMAS, type ContentFile } from './schemas';
import { contentHash as hashOf } from './hash';
import { validateContent } from './validate';

export type Content = { readonly [F in ContentFile]: Infer<(typeof SCHEMAS)[F]> };
export { validateContent } from './validate';
export { contentHash as hashContent } from './hash';

/** The content files as loaded, before any check: for tests and tools. */
export const rawContent: Readonly<Record<ContentFile, unknown>> = {
  abilities,
  ailments,
  awakenings,
  biomes,
  calendar,
  conditions,
  creatures,
  cultures,
  diseases,
  dragons,
  events,
  faiths,
  features,
  'great-works': greatWorks,
  items,
  jobs,
  lore,
  memories,
  names,
  needs,
  races,
  region,
  resources,
  schools,
  seasons,
  terrain,
  tiers,
  traits,
  weather,
};

const errors = validateContent(rawContent);
if (errors.length > 0) throw new Error(`Content is invalid:\n${errors.join('\n')}`);

/** All content, valid by the schemas in schemas.ts. */
export const content = rawContent as unknown as Content;
/** Fingerprint of `content`; changes whenever any entry does. */
export const contentHash: string = hashOf(rawContent);
