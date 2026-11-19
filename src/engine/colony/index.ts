// Public surface of the colony system.
export { colonySystem } from './system.ts';
export { colonyMood, type ColonyMood, type MoodCause } from './mood.ts';
export { trustOf } from './elder.ts';
export { addCause, hardTimes } from './standing.ts';
export {
  causesOf,
  COLONY_TABLES,
  colonyRow,
  elderOf,
  factionOf,
  factionsOf,
  standingOf,
  standingWord,
} from './tables.ts';
