// Public surface of the flock system (MODULE.md).
export { flockSystem } from './system.ts';
export {
  animalWord,
  daysTo,
  flockOf,
  flocksOf,
  FLOCK_TABLES,
  headOf,
  keptOf,
  kindDef,
  pastureOf,
} from './flock.ts';
export { bringIn, canTame, foldFlock, openFlock, takeIn, tameTargets } from './tame.ts';
export { addToRick, mowable, mowTile, readySwaths, takeHay } from './hay.ts';
export { butcher, marked, shear, shearable } from './cull.ts';
export { noteLeftOut } from './pack.ts';
