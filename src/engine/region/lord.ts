// The colony's lord (6C Slice 1, V-210, V-216): the ruler (`Civ.rulerId`) of the realm of the
// nearest valley neighbour, by days, whose realm has not fallen; else the nearest live realm among
// the region's sites; else the first live realm in the world (V-211's small default). Read from the
// Story Generator world once, when the reeve first comes; the lord system keeps the copy.
import type { EngineContent } from '../core/index.ts';
import { storyContent, storyWorld, type WorldState } from './story.ts';
import type { RegionSite, RegionValley } from './region.ts';
import { compass } from './names.ts';
import { siteOf, valleyOf } from './system.ts';

/** The lord as the colony learns of them, copied into the lord system's state. */
export interface Lord {
  /** The ruler's id in the Story Generator world. */
  id: number;
  name: string;
  sex: string;
  /** The history year they were born. */
  born: number;
  /** Their age in the world's last year of history. */
  age: number;
  /** Whether they are under their race's age of maturity. */
  child: boolean;
  temper: string;
  /** The package's word and line for the temper ("bold", "quick to draw a sword..."). */
  temperWord: string;
  temperLine: string;
  /** Their earned byname ("the Builder"), or '' for none. */
  byname: string;
  /** The realm's name and the word its kind is named by ("Jarldom" of "Jarldom of Brandby"). */
  realm: string;
  kind: string;
  /** The realm's capital, where the lord sits. */
  home: string;
  /** The lord's people (a culture id). */
  culture: string;
  /** The compass word from the valley to the neighbour the lord was found through. */
  dir: string;
}

interface Civ {
  id: number;
  name: string;
  cultureId: string;
  capital?: number;
  fell?: number;
  rulerId?: number;
}
interface Ruler {
  name: string;
  raceId?: string;
  cultureId?: string | null;
  sex?: string;
  born?: number;
  died?: number;
  temper?: string;
  byname?: { text: string };
}
interface TemperDef {
  id: string;
  word: string;
  line: string;
}

/** The package's tempers (history `tempers`). */
export function tempersOf(content: EngineContent): readonly TemperDef[] {
  const history = storyContent(content)['history'] as { tempers?: { tempers?: TemperDef[] } };
  return history.tempers?.tempers ?? [];
}

const civsOf = (world: WorldState) => world.civs as unknown as Map<number, Civ>;
const rulerOf = (world: WorldState, civ: Civ): Ruler | undefined =>
  civ.rulerId === undefined ? undefined : (world.people.get(civ.rulerId) as Ruler | undefined);
/** A realm that still stands and has a living ruler. */
const live = (world: WorldState, civ: Civ | undefined): civ is Civ => {
  if (!civ || civ.fell !== undefined) return false;
  const r = rulerOf(world, civ);
  return !!r && r.died === undefined;
};

/** The realm a region site belongs to, found by its name in the world. */
function civAt(world: WorldState, name: string): Civ | undefined {
  for (const s of world.sites.values())
    if (s.name === name) return s.civId === null ? undefined : civsOf(world).get(s.civId);
  return undefined;
}

/** The realm the lord rules and the side the road to it leaves by. */
function realmFor(
  world: WorldState,
  sites: readonly RegionSite[],
  valley: RegionValley,
): { civ: Civ; dir: string } | undefined {
  for (const n of valley.near) {
    const civ = civAt(world, n.name);
    if (live(world, civ)) return { civ, dir: n.dir };
  }
  const far = (s: RegionSite) => Math.abs(s.x - valley.x) + Math.abs(s.y - valley.y);
  for (const s of [...sites].sort((a, b) => far(a) - far(b) || (a.name < b.name ? -1 : 1))) {
    const civ = civAt(world, s.name);
    if (live(world, civ)) return { civ, dir: compass(s.x - valley.x, s.y - valley.y) };
  }
  const first = [...civsOf(world).values()].find((c) => live(world, c));
  return first && { civ: first, dir: valley.near[0]?.dir ?? 'south' };
}

/** The lord of a valley in a given Story Generator world (tests hand it a world with a fallen
 * realm), or undefined when no realm in the world stands. */
export function lordIn(
  world: WorldState,
  sites: readonly RegionSite[],
  valley: RegionValley,
  content: EngineContent,
): Lord | undefined {
  const found = realmFor(world, sites, valley);
  if (!found) return undefined;
  const { civ, dir } = found;
  const r = rulerOf(world, civ)!;
  const temper = tempersOf(content).find((t) => t.id === r.temper);
  const born = r.born ?? 0;
  const age = content.region.world.years - born;
  const race = content.region.world.races[r.raceId ?? ''] ?? r.raceId;
  const maturity = content.races.find((x) => x.id === race)?.maturityYears ?? 16;
  const capital = civ.capital === undefined ? undefined : world.sites.get(civ.capital);
  return {
    ...{ id: civ.rulerId!, name: r.name, sex: r.sex ?? 'm', born, age, child: age < maturity },
    ...{ temper: r.temper ?? '', temperWord: temper?.word ?? '', temperLine: temper?.line ?? '' },
    ...{ byname: r.byname?.text ?? '', realm: civ.name, kind: kindOf(civ.name) },
    ...{ home: capital?.name ?? civ.name, culture: r.cultureId ?? civ.cultureId, dir },
  };
}

/** The word a realm's name gives its kind: "Jarldom" of "Jarldom of Brandby", "Khanate" of
 * "Saruk Khanate", "Free City" of "Free City of Lanport". */
export function kindOf(realm: string): string {
  const of = / of /.exec(realm);
  if (of) return realm.slice(0, of.index);
  return realm.split(' ').at(-1) ?? realm;
}

/** The lord of the valley a world seed settles, or undefined for a plain seed (no region). */
export function lordOf(seed: string, content: EngineContent): Lord | undefined {
  const found = valleyOf(seed, content);
  if (!found) return undefined;
  const world = storyWorld(siteOf(seed)!.region, content);
  return lordIn(world, found.region.sites, found.valley, content);
}

/** The names of a people (a culture id), from the package's cultures with Vulcan's laid over. */
export function namesOf(
  content: EngineContent,
  culture: string,
): EngineContent['cultures'][number]['names'] | undefined {
  const own = content.cultures.find((c) => c.id === culture);
  if (own) return own.names;
  const all = storyContent(content)['cultures'] as { id: string; names: unknown }[];
  return all.find((c) => c.id === culture)?.names as EngineContent['cultures'][number]['names'];
}
