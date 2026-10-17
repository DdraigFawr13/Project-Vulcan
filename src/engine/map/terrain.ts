// The surface generator's ground: a valley's climate, height, biomes, rock and fertility, all
// from the `worldgen` stream and the dials in content (terrain.json `generator`, biomes.json).
import type { EngineContent, RngStream } from '../core/index.ts';
import { bake, fractalNoise, quantile } from './noise.ts';

export interface Ground {
  climate: string;
  temperature: number;
  rainfall: number;
  elevation: number[];
  biomes: number[];
  fertility: number[];
  tiles: number[];
}

// cos and sin of k * 22.5 degrees, k = 0 to 15.
const C1 = 0.9238795325;
const C2 = 0.7071067812;
const C3 = 0.3826834324;
const AXES: readonly (readonly [number, number])[] = [
  [1, 0],
  [C1, C3],
  [C2, C2],
  [C3, C1],
  [0, 1],
  [-C3, C1],
  [-C2, C2],
  [-C1, C3],
  [-1, 0],
  [-C1, -C3],
  [-C2, -C2],
  [-C3, -C1],
  [0, -1],
  [C3, -C1],
  [C2, -C2],
  [C1, -C3],
];

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The band a value falls in: 0 below the first edge, `edges.length` above the last. */
function band(value: number, edges: readonly number[]): number {
  let i = 0;
  while (i < edges.length && value >= edges[i]!) i += 1;
  return i;
}

/** A whole-number draw from a [min, max] range, at one decimal place. */
const draw = (rng: RngStream, [min, max]: readonly number[]): number =>
  rng.between(Math.round(min! * 10), Math.round(max! * 10)) / 10;

/**
 * Lays out the ground of a width by height valley. Elevation is a trough along a random axis
 * through the middle, roughened by fractal noise; the top `rock.wall` share of tiles is rock and
 * the next `rock.scree` share scree, and the peaks of a fine noise field (`rock.outcrops` of the
 * map) are crags of rock on the floor. Temperature falls with height by `lapse` degrees a
 * kilometre; rainfall is the climate's, varied by noise and raised on the valley floor. The
 * biome comes from the forked temperature-by-rainfall table.
 */
export function layGround(
  rng: RngStream,
  content: EngineContent,
  width: number,
  height: number,
): Ground {
  const gen = content.terrain.generator;
  const { biomes, rules } = content.biomes;
  const kindIndex = (id: string): number => {
    const i = content.terrain.kinds.findIndex((k) => k.id === id);
    if (i < 0) throw new Error(`Terrain "${id}" is not a terrain kind.`);
    return i;
  };
  const biomeIndex = (id: string): number => {
    const i = biomes.findIndex((b) => b.id === id);
    if (i < 0) throw new Error(`Biome "${id}" is not a biome.`);
    return i;
  };

  const climate = rng.weighted(gen.climates.map((c) => [c, Math.round(c.weight * 10)] as const));
  const temperature = draw(rng, climate.temperature);
  const rainfall = Math.round(draw(rng, climate.rainfall));
  const floor = Math.round(draw(rng, gen.elevation.floor));
  const relief = Math.round(draw(rng, gen.elevation.relief));

  // The valley's axis: one of 16 compass directions, as unit vectors written out, so no
  // trigonometry or square roots run in the engine.
  const [ax, ay] = rng.pick(AXES);

  const { cell, octaves } = gen.noise;
  const rough = bake(fractalNoise(rng, width, height, cell, octaves), width, height);
  const bend = bake(fractalNoise(rng, width, height, cell * 3, 2), width, height);
  const wet = bake(fractalNoise(rng, width, height, cell, 3), width, height);
  const soil = bake(fractalNoise(rng, width, height, cell / 2, 2), width, height);
  const crags = bake(fractalNoise(rng, width, height, gen.rock.outcropCell, 3), width, height);

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const half = Math.min(width, height) / 2;
  const elevation = new Array<number>(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      // Distance across the axis, 0 on the valley floor's line and about 1 at the map's sides.
      const across = ((x - cx) * ay - (y - cy) * ax) / half;
      const off = across + (bend[i]! - 0.5) * 2 * gen.elevation.axisNoise;
      const trough = clamp(off * off, 0, 1.5);
      elevation[i] = Math.round(floor + relief * (0.6 * trough + 0.4 * rough[i]!));
    }

  const wallFrom = quantile(elevation, 1 - gen.rock.wall);
  const screeFrom = quantile(elevation, 1 - gen.rock.wall - gen.rock.scree);
  const outcropFrom = quantile(crags, 1 - gen.rock.outcrops);
  const lowland = quantile(elevation, gen.swampLowland);
  const valleyFloor = quantile(elevation, 0.02);
  const rock = kindIndex('rock-wall');
  const scree = kindIndex('gravel');
  const alpine = biomeIndex('alpine');
  const swamp = biomeIndex('swamp');

  const tiles = new Array<number>(width * height);
  const biomeOf = new Array<number>(width * height);
  const fertility = new Array<number>(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const e = elevation[i]!;
    const t = temperature - (gen.elevation.lapse * (e - valleyFloor)) / 1000;
    const low = e <= lowland;
    const rain = rainfall * (0.75 + 0.5 * wet[i]!) + (low ? gen.lowlandRain : 0);
    let b = biomeIndex(
      rules.table[band(t, rules.temperatureBands)]![band(rain, rules.rainfallBands)]!,
    );
    if (e >= rules.alpineElevation) b = alpine;
    else if (low && rain >= rules.swampRainfall && t >= rules.swampMinTemp) b = swamp;
    biomeOf[i] = b;
    // Rock: the heights, plus a scatter of crags standing out of the valley floor.
    if (e >= wallFrom || crags[i]! >= outcropFrom) {
      tiles[i] = rock;
      fertility[i] = 0;
      continue;
    }
    const floorKind = content.terrain.floors[biomes[b]!.id];
    tiles[i] = e >= screeFrom ? scree : kindIndex(floorKind ?? content.terrain.surface.ground);
    const base = biomes[b]!.fertility * (0.7 + 0.6 * soil[i]!);
    fertility[i] = Math.round(clamp(e >= screeFrom ? base / 4 : base, 0, 100));
  }
  return {
    climate: climate.id,
    temperature,
    rainfall,
    elevation,
    biomes: biomeOf,
    fertility,
    tiles,
  };
}
