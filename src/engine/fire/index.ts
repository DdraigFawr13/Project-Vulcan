// Public surface of the fire system.
export { fireSystem } from './system.ts';
export {
  bankFire,
  createFire,
  FIRE_TABLES,
  fireOf,
  firesOf,
  fuelOf,
  layHearth,
  pieceOfFire,
  placeOf,
  reachOf,
} from './fire.ts';
export { heatAt, heatMap } from './heat.ts';
