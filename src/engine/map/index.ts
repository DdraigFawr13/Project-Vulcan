// Public surface of the map system.
export { mapSystem } from './map.ts';
export {
  CHUNK,
  chunksAcross,
  chunksDown,
  chunkTiles,
  diggable,
  layerOf,
  builtEpoch,
  chunkEpoch,
  raiseChunk,
  setBuilt,
  setTile,
  withBuilt,
  withBuiltAll,
} from './tiles.ts';
export { auraAt } from './aura.ts';
export { tread, walksADay, wearStage } from './wear.ts';
export { cutStairsAt, openAround, sinkShaftAt } from './levels.ts';
export { makeLevel } from './underground.ts';
export { compass } from './green.ts';
export { atLookout, bankTiles, foundAreas, placeKind } from './places.ts';
export { faceList, faceWalked, isFace, rockOdds, seamAt, walkFaces } from './faces.ts';
export {
  bareKnown,
  eachKnown,
  inAreas,
  isKnown,
  see,
  tellSeen,
  forgetSeen,
  workAreas,
  type Area,
} from './known.ts';
