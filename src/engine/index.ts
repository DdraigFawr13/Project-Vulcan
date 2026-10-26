// The engine's one public surface. The engine is pure: same seed, content and commands, same
// ledger, tick for tick (DECISIONS V-002, V-006). The worker is the only place it is run.
import { buildSystem } from './build/index.ts';
import { calendarSystem } from './calendar/index.ts';
import { fireSystem } from './fire/index.ts';
import { flockSystem } from './flock/index.ts';
import { goodsSystem } from './goods/index.ts';
import { healthSystem } from './health/index.ts';
import { mapSystem } from './map/index.ts';
import { mineSystem } from './mine/index.ts';
import { needsSystem } from './needs/index.ts';
import { lawSystem } from './law/index.ts';
import { peopleSystem, strangersSystem } from './people/index.ts';
import { regionSystem } from './region/index.ts';
import { weatherSystem } from './weather/index.ts';
import { wildSystem } from './wild/index.ts';
import type { EngineContent } from './core/index.ts';
import { createSim as createSimWith, type Sim, type System } from './sim/index.ts';

export * from './core/index.ts';
export * from './log/index.ts';
export * from './entity/index.ts';
export { applyDue, createWorld, replay, step, submitCommand } from './sim/index.ts';
export type { Cadence, Sim, System, SystemContext } from './sim/index.ts';
export {
  bedOwnedBy,
  bedsOf,
  burialGround,
  middensOf,
  burialsOf,
  freePlots,
  gravesOf,
  inBurial,
  benchOf,
  buildSystem,
  buildWantOf,
  dirFrom,
  furnitureKind,
  furnitureOf,
  greenOf,
  cropNow,
  courseNow,
  farFromWater,
  meanSoil,
  wetDays,
  ringOf,
  cropOf,
  fieldDone,
  fieldsOf,
  fieldTiles,
  foldRect,
  foldTiles,
  grazingTiles,
  hurdleTiles,
  livePastures,
  nextRoad,
  roadAt,
  roadsOf,
  meadowTiles,
  pasturesOf,
  homeless,
  houseAt,
  housesOf,
  mainOf,
  nextWant,
  nthOf,
  partOf,
  pieceAt,
  piecesOf,
  planAt,
  nextNeed,
  planPart,
  plansOf,
  qualityOf,
  rectOf,
  roomAt,
  roomLacks,
  roomName,
  roomsOf,
  rowsOf,
  sizeOf,
  waterSpots,
  wellsOf,
  ingotInStore,
  sendBackBlock,
  smithiesOf,
  stationAt,
  stationOf,
  stationsOf,
  type Room,
  hallOf,
  homeFor,
  householdOf,
  sleepsIn,
  whoseOf,
} from './build/index.ts';
export { calendarSystem } from './calendar/index.ts';
export {
  armOut,
  bedWords,
  bodiesOf,
  bodyOf,
  healthSystem,
  herbedNow,
  isDown,
  markPercent,
  openWounds,
  pronouns,
  scarsOf,
  severityOf,
  withoutAccidents,
  woundName,
  woundsOf,
  woundWords,
} from './health/index.ts';
export { SHAFT_STATES } from './mine/index.ts';
export { fireOf, fireSystem, heatAt, placeOf } from './fire/index.ts';
export { shaftFor, shaftsOf } from './mine/index.ts';
export {
  freeTile,
  garmentOf,
  leftOf,
  wornOf,
  goodsSystem,
  depotsOf,
  depotTiles,
  insideDepot,
  haveOf,
  heldBy,
  ingotWant,
  inStore,
  isTree,
  itemsAt,
  itemsOf,
  lifeFor,
  loadOf,
  marksOf,
  sparesOf,
  speedOf,
  stockOf,
  storeOf,
  toolOf,
  trailOf,
  wantOf,
} from './goods/index.ts';
export {
  addMemories,
  addMemory,
  feltAt,
  memoriesOf,
  moodOf,
  needOf,
  needsSystem,
  warmLineOf,
} from './needs/index.ts';
export {
  customaryHours,
  hoursOf,
  lawDef,
  lawHours,
  lawSystem,
  leanOf,
  settingOf,
  weigh,
  WORK_HOURS,
  type Answer,
} from './law/index.ts';
export {
  dayOf,
  declinedLine,
  drawBand,
  levelOf,
  peopleSystem,
  PEOPLE_TABLES,
  progressOf,
  tradeOf,
  yesterdayOf,
} from './people/index.ts';
export type { Day, Tally, Home, Person } from './people/index.ts';
export { makeRegion, regionSystem, siteOf, valleyOf } from './region/index.ts';
export type { Region, RegionNeighbour, RegionSite, RegionValley } from './region/index.ts';
export { isFrozen, tileTemperature, weatherSystem, weatherWords } from './weather/index.ts';
export {
  addToRick,
  animalWord,
  butcher,
  canTame,
  daysTo,
  flockOf,
  flocksOf,
  flockSystem,
  FLOCK_TABLES,
  foldFlock,
  headOf,
  keptOf,
  kindDef,
  marked,
  mowable,
  mowTile,
  noteLeftOut,
  openFlock,
  pastureOf,
  readySwaths,
  shear,
  shearable,
  takeHay,
  takeIn,
  tameTargets,
} from './flock/index.ts';
export {
  animalsOf,
  herdOf,
  herdsOf,
  wildHerdsOf,
  feedPack,
  huntable,
  killAnimal,
  markAttack,
  packArrival,
  packOf,
  predatorsNear,
  printsAt,
  setLures,
  spareCount,
  tameAnimal,
  WILD_TABLES,
  wildSystem,
  withoutWild,
  woundPredator,
} from './wild/index.ts';
export {
  auraAt,
  CHUNK,
  chunksAcross,
  chunksDown,
  chunkTiles,
  walksADay,
  layerOf,
  mapSystem,
  setTile,
} from './map/index.ts';

/** The test-mode tools (V-041): direct orders on a tile, never levers. The worker refuses them
 * unless the page opened in test mode. */
export const TEST_TOOLS: readonly string[] = [
  'placeBuilding',
  'deconstruct',
  'cutStairs',
  'sinkShaft',
  'markFell',
  'markStore',
  'hurt',
];

/** The game's systems in tick order. Later milestones add theirs here. */
export const SYSTEMS: readonly System[] = [
  regionSystem,
  mapSystem,
  peopleSystem,
  strangersSystem,
  healthSystem,
  goodsSystem,
  buildSystem,
  mineSystem,
  fireSystem,
  needsSystem,
  lawSystem,
  calendarSystem,
  weatherSystem,
  wildSystem,
  flockSystem,
];

/** A simulation over `content` with the game's systems, or the given ones (tests add fixtures). */
export const createSim = (
  content: EngineContent,
  systems: readonly System[] = SYSTEMS,
  recentDays?: number,
): Sim => createSimWith(content, systems, recentDays);
