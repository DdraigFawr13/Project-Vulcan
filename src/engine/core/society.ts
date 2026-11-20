// The content the colony's inner life reads, as one shape: tales and beliefs, the self, the colony
// as a whole, families, faith, the tavern and defiance (Phase 6). types.ts `EngineContent` extends it.
import type { ColonyDefs } from './colony.ts';
import type { DefyDefs } from './defy.ts';
import type { FamilyDefs } from './family.ts';
import type { SelfDefs } from './self.ts';
import type { TalesDefs } from './tales.ts';
import type { TavernDefs } from './tavern.ts';
import type { WorshipDefs } from './worship.ts';

export interface SocietyDefs
  extends TalesDefs, SelfDefs, ColonyDefs, FamilyDefs, WorshipDefs, TavernDefs, DefyDefs {}
