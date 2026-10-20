// Public surface of the wild system.
export { wildSystem } from './system.ts';
export {
  animalsOf,
  herdOf,
  herdsOf,
  huntable,
  membersOf,
  markAttack,
  packOf,
  predatorsNear,
  speciesOf,
  spareCount,
  WILD_TABLES,
} from './wild.ts';
export { killAnimal } from './kill.ts';
export { scareHerd, woundPredator } from './fight.ts';
export { approach } from './move.ts';
export { printsAt } from './prints.ts';
export { whenWord } from './ground.ts';
export { drawOff, setLures } from './visit.ts';
export { withoutWild } from './calm.ts';
