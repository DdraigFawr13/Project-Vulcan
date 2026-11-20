// Phase 6B's content shapes in one place (kin and craft: families, faith, teaching), so the
// engine content type stays under the file limit.
import type { FamilyDefs } from './family.ts';
import type { TeachDefs } from './teach.ts';
import type { WorshipDefs } from './worship.ts';

export interface KinDefs extends FamilyDefs, WorshipDefs, TeachDefs {}
