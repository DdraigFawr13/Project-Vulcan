// Public surface of the lamp: daylight by month and light after dusk (P5.13).
export { daylightAt, isDark, nextDawn, type Daylight } from './daylight.ts';
export {
  canLight,
  LAMP_TABLES,
  lightClass,
  lightsOf,
  lit,
  litRooms,
  type LightClass,
} from './light.ts';
export { lampSystem } from './system.ts';
