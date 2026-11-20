// Public surface of the fire system.
export { fireSystem } from './system.ts';
export {
  ashIn,
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
  takeAsh,
} from './fire.ts';
export { airHour, airOf, leakOf } from './air.ts';
export { heatAt, heatMap } from './heat.ts';
