// The colony's customary day (P2.5): work runs from `workFrom` to `workTo` o'clock, free time
// until `sleepFrom`, and night until work starts again. It is content's `work.hours` and
// `life.sleep.from`; the work-hours law (law/hours.ts) sets everyone's hours from there.
import type { EngineContent, WorldState } from '../core/index.ts';

export interface Day {
  workFrom: number;
  workTo: number;
  sleepFrom: number;
}

/** The colony's customary day. */
export function dayOf(_world: WorldState, content: EngineContent): Day {
  return {
    workFrom: content.work.hours.from,
    workTo: content.work.hours.to,
    sleepFrom: content.life.sleep.from,
  };
}
