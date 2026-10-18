// The surface generator's ground: a valley's climate, height, biomes, rock and fertility, all
// from the `worldgen` stream and the dials in content (terrain.json `generator`, biomes.json).
import type { EngineContent, RngStream } from '../core/index.ts';
import { raiseMountains } from './mountains.ts';
import { AXES, bake, fractalNoise, quantile } from './noise.ts';

export interface Ground {
  /** The valley floor's height (m): the share `valleyFloor` of tiles lie lower. */
  floor: number;
  climate: string;
  temperature: number;
  rainfall: number;
  elevation: number[];
  biomes: number[];
  fertility: number[];
  tiles: number[];
  /** 1 where rock is snow-capped. */
  snow: number[];
  /** The height rock starts at (metres), the valley's axis as a unit vector, and the broad
   * moisture field in [0, 1], for the water that follows. */
  wallFrom: number;
  axis: readonly [number, number];
  wet: number[];
}

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
 * through the middle, roughened by fractal noise; rock starts `rock.line` metres above the valley floor (held
 * between the `rock.wall` shares of the map) and the next `rock.scree` share is scree, and the peaks of a fine noise field (`rock.outcrops` of the
 * map) are crags of rock on the floor. Temperature falls with height by `lapse` degrees a
 * kilometre; rainfall is the climate's, varied by a broad moisture field and raised on the
 * valley floor. The biome comes from the forked temperature-by-rainfall table. Ridged noise on
 * the slopes gives the walls spurs. Massifs (mountains.ts) of varied size stand on the rims and
 * in the valley, each of one rock drawn by weight; the walls outside them share one rock; rock
 * colder than `rock.snowline` in the top `rock.snowTop` of the heights is snow-capped (the `snow` layer; the tile keeps its rock).
 */
export function layGround(
  rng: RngStream,
  content: EngineContent,
  width: number,
  height: number,
  /** A climate id the region chose for this valley; otherwise one is drawn by weight. */
  climateId?: string,
): Ground {
  const gen = content.terrain.generator;
  const { biomes, rules } = content.biomes;
  const kinds = new Map(content.terrain.kinds.map((k, i) => [k.id, i]));
  const biomeIds = new Map(biomes.map((b, i) => [b.id, i]));
  const kindIndex = (id: string): number => {
    const i = kinds.get(id);
    if (i === undefined) throw new Error(`Terrain "${id}" is not a terrain kind.`);
    return i;
  };
  const biomeIndex = (id: string): number => {
    const i = biomeIds.get(id);
    if (i === undefined) throw new Error(`Biome "${id}" is not a biome.`);
    return i;
  };

  const climate =
    gen.climates.find((c) => c.id === climateId) ??
    rng.weighted(gen.climates.map((c) => [c, Math.round(c.weight * 10)] as const));
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
  const { moisture, ridges } = gen;
  const wet = bake(fractalNoise(rng, width, height, moisture.cell, 3), width, height);
  const ridge = bake(fractalNoise(rng, width, height, ridges.cell, 3), width, height);
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
      // Ridged noise (high along its zero lines) on the slopes: spurs and saddles in the walls.
      const spur = (1 - Math.abs(2 * ridge[i]! - 1)) * clamp(trough, 0, 1);
      elevation[i] = floor + relief * (0.6 * trough + 0.4 * rough[i]! + ridges.weight * spur);
    }
  const ridgedField = ridge.map((r) => 1 - Math.abs(2 * r - 1));
  const peaks = raiseMountains(rng, gen, width, height, [ax, ay], ridgedField);
  for (let i = 0; i < width * height; i += 1)
    elevation[i] = Math.round(elevation[i]! + peaks.lift[i]!);

  const outcropFrom = quantile(crags, 1 - gen.rock.outcrops);
  const lowland = quantile(elevation, gen.swampLowland);
  const valleyFloor = quantile(elevation, gen.valleyFloor);
  // Rock from a height above the valley floor, so big mountains add rock, held between the
  // `wall` shares of the map; scree is the next `scree` share below it.
  const [fewest, most] = gen.rock.wall;
  const wallFrom = clamp(
    valleyFloor + gen.rock.line,
    quantile(elevation, 1 - most!),
    quantile(elevation, 1 - fewest!),
  );
  let walls = 0;
  for (const e of elevation) if (e >= wallFrom) walls += 1;
  const screeFrom = quantile(elevation, 1 - walls / elevation.length - gen.rock.scree);
  const snowFrom = quantile(elevation, 1 - (walls / elevation.length) * gen.rock.snowTop);
  // The valley's walls are one rock; each massif is its own.
  const wallRock = kindIndex(
    rng.weighted(gen.rocks.map((r) => [r.kind, Math.round(r.weight * 10)] as const)),
  );
  const scree = kindIndex(gen.rock.screeKind);
  const alpine = biomeIndex(gen.alpine);
  const swamp = biomeIndex(gen.swamp);

  const tiles = new Array<number>(width * height);
  const biomeOf = new Array<number>(width * height);
  const fertility = new Array<number>(width * height);
  const snow = new Array<number>(width * height).fill(0);
  for (let i = 0; i < width * height; i += 1) {
    const e = elevation[i]!;
    const t = temperature - (gen.elevation.lapse * (e - valleyFloor)) / 1000;
    const low = e <= lowland;
    const rain = rainfall * (moisture.low + moisture.span * wet[i]!) + (low ? gen.lowlandRain : 0);
    let b = biomeIndex(
      rules.table[band(t, rules.temperatureBands)]![band(rain, rules.rainfallBands)]!,
    );
    if (e >= rules.alpineElevation) b = alpine;
    else if (low && rain >= rules.swampRainfall && t >= rules.swampMinTemp) b = swamp;
    biomeOf[i] = b;
    // Rock: the heights, plus a scatter of crags standing out of the valley floor.
    if (e >= wallFrom || crags[i]! >= outcropFrom) {
      const own = peaks.rock[i]!;
      tiles[i] = own ? kindIndex(own) : wallRock;
      if (t < gen.rock.snowline && e >= snowFrom) snow[i] = 1;
      fertility[i] = 0;
      continue;
    }
    const floorKind = content.terrain.floors[biomes[b]!.id];
    tiles[i] = e >= screeFrom ? scree : kindIndex(floorKind ?? content.terrain.surface.ground);
    const base = biomes[b]!.fertility * (0.7 + 0.6 * soil[i]!);
    fertility[i] = Math.round(clamp(e >= screeFrom ? base / 4 : base, 0, 100));
  }
  return {
    floor: valleyFloor,
    wallFrom,
    axis: [ax, ay],
    wet,
    climate: climate.id,
    temperature,
    rainfall,
    elevation,
    biomes: biomeOf,
    fertility,
    tiles,
    snow,
  };
}
