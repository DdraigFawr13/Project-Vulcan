// The surface map: laid out once when a world begins by the terrain generator, from the reserved
// `worldgen` stream; afterwards only `setTile` changes a tile. The levels below wait in levels.ts.
import type { MapState } from '../core/index.ts';
import { valleyOf } from '../region/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { layAura, placesOf } from './aura.ts';
import { placeFeatures } from './features.ts';
import { findGreens, greenWords } from './green.ts';
import { digCommands } from './levels.ts';
import { chunksAcross, chunksDown } from './tiles.ts';
import { makeLevel } from './underground.ts';
import { layGround } from './terrain.ts';
import { BEACH, carveWater, MARSH, SCREE, SPRING } from './water.ts';

/** Lays out the map in `init` (generation belongs there, not in a cadence); it never runs on load. */
export const mapSystem: System = {
  id: 'map',
  every: 'day', // a cadence is required; the surface has no daily work yet
  stream: 'worldgen',
  emits: [
    'map.formed',
    'map.green',
    'map.greenAgain',
    'map.watered',
    'map.aura',
    'map.auraDeep',
    'map.levelReached',
    'map.stairsCut',
    'map.shaftSunk',
    'map.opened',
    'map.digRefused',
  ],
  commands: digCommands,
  // `look` is 1 when the player sent the band's first green back on arrival (the world is then
  // made again with it set); `next` is 1 when there is a second choice to send it back for.
  initialState: { look: 0, next: 0 },
  init(ctx) {
    const { width, height } = ctx.content.terrain.surface;
    const rng = ctx.rng();
    // A valley seed (`<seed>/<n>`) takes the climate the region gave that valley.
    const climate = valleyOf(ctx.world.seed, ctx.content)?.valley.climate;
    const ground = layGround(rng, ctx.content, width, height, climate);
    const water = carveWater(rng, ctx.content, ground, width, height);
    const dials = ctx.content.terrain.generator.water;
    const kind = (id: string): number => ctx.content.terrain.kinds.findIndex((k) => k.id === id);
    const shores: Record<number, number> = {
      [BEACH]: kind(dials.beach),
      [SCREE]: kind(ctx.content.terrain.generator.rock.screeKind),
      [MARSH]: kind(dials.marsh),
    };
    for (let i = 0; i < width * height; i += 1) {
      const body = water.body[i]!;
      if (body === SPRING) ground.tiles[i] = kind(dials.spring);
      else if (body) ground.tiles[i] = kind(water.deep[i] ? dials.deep : dials.shallow);
      else if (water.shore[i]) ground.tiles[i] = shores[water.shore[i]!]!;
    }
    const features = placeFeatures(rng, ctx.content, ground, width, height);
    const greens = findGreens(ctx.content, ground.tiles, features, ground.elevation, width, height);
    const look = Math.min(ctx.state['look'] ?? 0, greens.length - 1);
    const start = greens[look]!;
    ctx.state['next'] = greens.length > 1 ? 1 : 0;
    const map = ctx.world.map;
    map.width = width;
    map.height = height;
    map.tiles = ground.tiles;
    map.elevation = Int16Array.from(ground.elevation);
    map.biomes = Uint8Array.from(ground.biomes);
    map.fertility = Uint8Array.from(ground.fertility);
    map.features = Uint8Array.from(features);
    map.snow = Uint8Array.from(ground.snow);
    map.water = Uint8Array.from(water.body);
    map.rock = Uint8Array.from(ground.tiles, (t) =>
      ctx.content.terrain.kinds[t]!.stone ? t + 1 : 0,
    );
    map.riverExit = water.exit;
    map.startX = start.x;
    map.startY = start.y;
    map.climate = ground.climate;
    map.temperature = ground.temperature;
    map.rainfall = ground.rainfall;
    map.floor = Math.round(ground.floor);
    map.ice = new Uint8Array(width * height);
    map.built = new Uint8Array(width * height);
    map.chunkVersions = new Array<number>(chunksAcross(map) * chunksDown(map)).fill(1);
    // The levels below are made only when first reached (levels.ts).
    map.levels = new Array<null>(ctx.content.terrain.generator.underground.depth).fill(null);
    map.stains = stainsOf(ctx, map);
    const formed = ctx.emit('map.formed', {
      causes: [ctx.world.begunEvent],
      data: {
        width,
        height,
        climate: ctx.content.terrain.generator.climates.find((c) => c.id === ground.climate)!.name,
        biome: mainBiome(ctx, ground.biomes),
        temperature: ground.temperature,
        rainfall: ground.rainfall,
        startX: start.x,
        startY: start.y,
        startMet: start.met ? 1 : 0,
      },
    });
    // Why the band stopped here, in words; a second look says how far it moved from the first.
    ctx.emit(look ? 'map.greenAgain' : 'map.green', {
      causes: [formed],
      data: greenWords(ctx.content, start, greens[0]!),
    });
    const watered = ctx.emit('map.watered', {
      causes: [formed],
      data: { exit: water.exit, lakes: water.lakes, springs: water.springs },
    });
    // Water cites the gathering of the waters; everything else, shores too, the valley's forming.
    map.tileCauses = water.body.map((b) => (b ? watered : formed));
    // Aura last, so its draws come after everything above and change none of it.
    const aura = layAura(rng, ctx.content, map);
    map.aura = aura.aura;
    map.auraSpots = aura.spots;
    // Like the valley's forming, the spots are part of the world as it began: no "why?" to offer.
    if (aura.spots.length)
      ctx.emit('map.aura', {
        causes: [ctx.world.begunEvent],
        data: { places: placesOf(ctx.content, aura.spots) },
      });
  },
};

/** The name of the biome covering the most tiles (ties to the earlier biome). */
function mainBiome(ctx: SystemContext, biomes: readonly number[]): string {
  const counts = new Array<number>(ctx.content.biomes.biomes.length).fill(0);
  for (const b of biomes) counts[b]! += 1;
  let best = 0;
  for (let b = 1; b < counts.length; b += 1) if (counts[b]! > counts[best]!) best = b;
  return ctx.content.biomes.biomes[best]!.name.toLowerCase();
}

/** The surface stain over each ore vein that has one (V-087): 0, or 1 + the vein's features
 * index; the shallowest stained level wins. The levels are laid out only to read their veins
 * (their own `veins` sub-streams, so nothing here touches `worldgen`). */
function stainsOf(ctx: SystemContext, map: MapState): Uint8Array {
  const stains = new Uint8Array(map.width * map.height);
  const levels = new Set<number>();
  ctx.content.features.forEach((f) => f.vein?.stain && levels.add(f.vein.level));
  for (const level of [...levels].sort((a, b) => a - b)) {
    const { features } = makeLevel(ctx.world.seed, ctx.content, map, level);
    for (let i = 0; i < features.length; i += 1) {
      const f = features[i]!;
      if (f && !stains[i] && ctx.content.features[f - 1]!.vein?.stain) stains[i] = f;
    }
  }
  return stains;
}
