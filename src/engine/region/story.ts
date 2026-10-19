// The Story Generator's world behind the region (P1.6, DECISIONS V-031): the package's own world and
// history engine, fed by an adapter from Vulcan's content. The package's tables keep their history
// tuning and their own ids; Vulcan's races and cultures are laid over its own, and the package's old
// race ids are read as the Vulcan races they became (region.json `world.races`).
import { DEFAULT_CONTENT } from 'story-generator/src/content/index.ts';
import {
  generateWorld,
  templateNarrator,
  validateContent,
  type WorldState,
} from 'story-generator/src/engine/index.ts';
import type { EngineContent } from '../core/index.ts';

export type { SimEvent, Site, WorldState } from 'story-generator/src/engine/index.ts';
export { D8_DX, D8_DY } from 'story-generator/src/engine/index.ts';

type Plain = Record<string, unknown>;

/** Vulcan's entry laid over each of the package's, matched by `idOf`: Vulcan's fields win, the
 * package fills the rest, and the package's own ids and links stay so its tables still agree. */
function overlay(
  base: unknown,
  ours: readonly { id: string }[],
  idOf: (id: string) => string,
  keep: readonly string[],
): Plain[] {
  const byId = new Map(ours.map((o) => [o.id, o]));
  return (base as Plain[]).map((entry) => {
    const own = Object.fromEntries(keep.map((k) => [k, entry[k]]));
    return { ...entry, ...byId.get(idOf(String(entry['id']))), ...own };
  });
}

const adapted = new WeakMap<EngineContent, Plain>();

/** The package's content with Vulcan's races and cultures laid over its own (names, place syllables,
 * government, faiths); throws on any problem the package's own validator finds, so a content change
 * that breaks the history fails loudly. */
export function storyContent(content: EngineContent): Plain {
  const known = adapted.get(content);
  if (known) return known;
  const bundle = {
    ...DEFAULT_CONTENT,
    races: overlay(DEFAULT_CONTENT['races'], content.races, (id) => raceOf(id, content), ['id']),
    cultures: overlay(DEFAULT_CONTENT['cultures'], content.cultures, (id) => id, ['id', 'raceId']),
  };
  const problems = validateContent(bundle);
  if (problems.length) throw new Error(`Story Generator content: ${problems.join('; ')}`);
  adapted.set(content, bundle);
  return bundle;
}

/** The Vulcan race a package race id names: its old ids (tylwyth, dvergar, cewri, fomori) became
 * elf, dwarf, giant and orc (region.json `world.races`). */
export const raceOf = (id: string, content: EngineContent): string =>
  content.region.world.races[id] ?? id;

// The last few worlds made, per content: the picker, its three valleys and the Region panel all ask
// for the same seed's world, which takes about a second and a half to make. Same seed, same world.
// Keyed by the content the world is made from (region, races, cultures), so a copy of the content
// with other seasons or rates, as tests make, shares the same seed's world.
const KEEP = 4;
interface Made {
  races: EngineContent['races'];
  cultures: EngineContent['cultures'];
  worlds: Map<string, WorldState>;
}
const made = new WeakMap<EngineContent['region'], Made>();

/** The Story Generator world for a region seed: its land and 250 years of history. */
export function storyWorld(seed: string, content: EngineContent): WorldState {
  let entry = made.get(content.region);
  if (!entry || entry.races !== content.races || entry.cultures !== content.cultures) {
    entry = { races: content.races, cultures: content.cultures, worlds: new Map() };
    made.set(content.region, entry);
  }
  const cache = entry.worlds;
  const known = cache.get(seed);
  if (known) return known;
  const { size, years } = content.region.world;
  const world = generateWorld(
    seed,
    { width: size, height: size, historyYears: years },
    storyContent(content),
  );
  cache.set(seed, world);
  if (cache.size > KEEP) cache.delete(cache.keys().next().value!);
  return world;
}

const narrators = new WeakMap<WorldState, ReturnType<typeof templateNarrator>>();
/** Renders the package's events in its own templates, naming people and sites. */
export function narrator(world: WorldState, content: EngineContent) {
  const known = narrators.get(world);
  if (known) return known;
  const told = templateNarrator(
    storyContent(content),
    (id) => world.people.get(id)?.name ?? world.sites.get(id)?.name ?? `#${id}`,
    (id) => world.people.get(id),
  );
  narrators.set(world, told);
  return told;
}
