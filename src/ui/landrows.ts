// The land's rows on a tile page: ground, stain, biome, height, fertility, temperature, ice,
// aura and water, each in words from the worker (GAME-02).
import type { TileView } from '../worker/index.ts';

/** Key and value for each thing the worker said about the land. Under a piece, a field or a shaft
 * plan the land says nothing: the page opens on that. */
export function landFacts(tile: TileView): string[][] {
  return [
    ['ground', tile.ground],
    ...(tile.stain ? [['stain', tile.stain]] : []),
    ...(tile.biome ? [['biome', tile.biome]] : []),
    ...(tile.elevation !== undefined ? [['height', `${tile.elevation} m`]] : []),
    ...(tile.fertility !== undefined ? [['fertility', `${tile.fertility} of 100`]] : []),
    ...(tile.temperature !== undefined && !tile.room
      ? [['temperature', `${tile.temperature} °C`]]
      : []),
    ...(tile.ice ? [['ice', tile.ice]] : []),
    ...(tile.prints ? [['prints', tile.prints]] : []),
    ...(tile.fade ? [['fade', tile.fade]] : []),
    ...(tile.snowLies ? [['snow', tile.snowLies]] : []),
    ...(tile.worn ? [['worn', tile.worn]] : []),
    ...(tile.road ? [['road', tile.road]] : []),
    ...(tile.aura ? [['aura', tile.aura]] : []),
    ...(tile.water ? [['water', tile.water]] : []),
    ...(tile.drinkable !== undefined ? [['drinkable', tile.drinkable ? 'yes' : 'no']] : []),
    ...(tile.crossing ? [['crossing', tile.crossing]] : []),
  ];
}
