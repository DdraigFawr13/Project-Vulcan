// Public surface of the build system.
export { buildSystem, greenOf } from './system.ts';
export {
  bedsOf,
  bedSpot,
  dirFrom,
  homeless,
  homeOf,
  houseAt,
  houseName,
  HOUSE_TABLES,
  mainOf,
  nthOf,
  rowsOf,
  sizeOf,
  wantOf as buildWantOf,
} from './houses.ts';
export { roomAt, type Room } from './rooms.ts';
export { housesOf, rectOf, type Rect } from './site.ts';
export {
  BUILD_TABLES,
  finishPlan,
  partOf,
  planAt,
  planPart,
  plansOf,
  refundOf,
  stillNeeded,
  takeDownPlan,
} from './plans.ts';
export {
  anyBench,
  bedOwnedBy,
  benchOf,
  furnitureOf,
  FURNITURE_TABLES,
  kindOf as furnitureKind,
  pieceAt,
  piecesOf,
  qualityOf,
} from './furniture.ts';
export {
  lacks as roomLacks,
  nextWant,
  roomName,
  roomsOf,
  siteFor,
  wantSignature,
  type RoomRow,
  type Want,
} from './wants.ts';
