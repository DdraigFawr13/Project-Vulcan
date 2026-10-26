// The bees system (P5.13, V-135): daily, once a field stands, sites the skep stand (skeps.ts). The
// beekeeping itself is people/beekeep.ts; swarms are drawn from this system's stream at the visit.
import type { System } from '../sim/index.ts';
import { BEES_TABLES, siteStand } from './skeps.ts';

export const beesSystem: System = {
  id: 'bees',
  every: 'day',
  stream: 'bees',
  emits: ['bees.sited', 'bees.skep', 'bees.swarm', 'bees.harvest', 'work.tookUpBees'],
  tables: BEES_TABLES,
  run: siteStand,
};
