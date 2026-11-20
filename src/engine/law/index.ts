// Public surface of the law system.
export { lawSystem } from './system.ts';
export { answerNow, LAW_TABLES } from './answer.ts';
export {
  customaryHours,
  hoursFor,
  hoursOf,
  isWinter,
  lawDef,
  lawHours,
  lawRow,
  settingOf,
  WORK_HOURS,
  type Hours,
} from './hours.ts';
export { flout } from './flout.ts';
export { ateFood, rationed, RATIONS } from './rations.ts';
export { answerTo, sickRule } from './sickness.ts';
export { leanOf, weigh, type Answer, type Weighed } from './weigh.ts';
