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
  spareCount,
  speciesOf,
  WILD_TABLES,
  wildHerdsOf,
} from './wild.ts';
export { killAnimal, tameAnimal } from './kill.ts';
export { scareHerd, woundPredator } from './fight.ts';
export { approach } from './move.ts';
export { printsAt } from './prints.ts';
export { whenWord } from './ground.ts';
export {
  drawOff,
  feedPack,
  packArrival,
  setLures,
  setWards,
  type Lure,
  type Ward,
} from './visit.ts';
export { withoutWild } from './calm.ts';
