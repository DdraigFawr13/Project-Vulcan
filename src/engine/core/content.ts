// The content the engine core reads, as one type (split from types.ts): each system's defs and
// the shared files.
import type { PeopleDefs } from './people.ts';
import type { FlockDefs } from './flock.ts';
import type { WildDefs } from './wild.ts';
import type { StrangersDefs } from './strangers.ts';
import type { LampDefs } from './lamp.ts';
import type { ClothesDefs } from './clothes.ts';
import type { TalesDefs } from './tales.ts';
import type { AnnalsDefs } from './annals.ts';
import type { SelfDefs } from './self.ts';
import type { ColonyDefs } from './colony.ts';
import type { FamilyDefs } from './family.ts';
import type { WorshipDefs } from './worship.ts';
import type { TeachDefs } from './teach.ts';
import type { CallingsDefs } from './callings.ts';
import type { DefyDefs } from './defy.ts';
import type { TavernDefs } from './tavern.ts';
import type { LordDefs } from './lord.ts';
import type { MethodsDefs } from './methods.ts';
import type { BiomesDef, SeasonsDef, WeatherDef } from './climate.ts';
import type { CalendarDef } from './clock.ts';
import type { FeatureDef } from './ground.ts';
import type { BuildingsDef, ItemDef, JobDef, LifeDef, MemoryDef, WorkDef } from './life.ts';
import type { CultureDef, NamesDef, RegionDef } from './region.ts';
import type { TerrainDef } from './types.ts';

/** The content the engine core reads. The worker passes the content layer's `content`. */
export interface EngineContent
  extends
    PeopleDefs,
    WildDefs,
    FlockDefs,
    StrangersDefs,
    LampDefs,
    ClothesDefs,
    TalesDefs,
    AnnalsDefs,
    SelfDefs,
    ColonyDefs,
    FamilyDefs,
    WorshipDefs,
    TeachDefs,
    CallingsDefs,
    TavernDefs,
    LordDefs,
    MethodsDefs,
    DefyDefs {
  calendar: CalendarDef;
  /** `notable`: when a line is an alert and a skip stop (P2.6, log/notable.ts); `importance` 1
   * to 3, the recaps keeping every line of 3 (annals, V-191). */
  events: readonly {
    id: string;
    template: string;
    importance?: number;
    notable?: Readonly<Record<string, string>>;
  }[];
  terrain: TerrainDef;
  biomes: BiomesDef;
  features: readonly FeatureDef[];
  weather: readonly WeatherDef[];
  seasons: SeasonsDef;
  /** The six schools of magic (forked schools.json): aura spots name theirs. */
  schools: readonly { id: string; name: string }[];
  /** The region around the valley (P1.5): its dials, and the forked cultures, races and names. */
  region: RegionDef;
  cultures: readonly CultureDef[];
  names: NamesDef;
  /** P2.2: needs, the daily round and the cart (life.json), and the forked items. */
  life: LifeDef;
  /** P4 (V-091): the memories a person can hold (memories.json). */
  memories: readonly MemoryDef[];
  items: readonly ItemDef[];
  /** P2.4: the colony's work (work.json) and the forked jobs. */
  work: WorkDef;
  jobs: readonly JobDef[];
  /** P3.1 and P3.2: the parts colonists build (buildings.json). */
  buildings: BuildingsDef;
}
