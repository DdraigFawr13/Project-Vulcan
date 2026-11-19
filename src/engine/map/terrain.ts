// The surface generator's ground: a valley's climate, height, biomes, rock and fertility, all
// from the `worldgen` stream and the dials in content (terrain.json `generator`, biomes.json).
import type { EngineContent, RngStream } from '../core/index.ts';
import { type Mountains, raiseMountains } from './mountains.ts';
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
  const look = lookups(content);
  const sky = drawClimate(rng, gen, climateId);
  // The valley's axis: one of 16 compass directions, as unit vectors written out, so no
  // trigonometry or square roots run in the engine.
  const axis = rng.pick(AXES);
  const fields = drawFields(rng, gen, width, height);
  const elevation = troughOf(gen, fields, axis, sky, width, height);
  const ridgedField = fields.ridge.map((r) => 1 - Math.abs(2 * r - 1));
  const peaks = raiseMountains(rng, gen, width, height, axis, ridgedField);
  for (let i = 0; i < width * height; i += 1)
    elevation[i] = Math.round(elevation[i]! + peaks.lift[i]!);
  const heights = heightsOf(gen, elevation, fields.crags);
  // The valley's walls are one rock; each massif is its own.
  const wallRock = look.kindIndex(
    rng.weighted(gen.rocks.map((r) => [r.kind, Math.round(r.weight * 10)] as const)),
  );
  const cover = coverAll(content, look, { sky, fields, heights, elevation, peaks, wallRock });
  return {
    floor: heights.valleyFloor,
    wallFrom: heights.wallFrom,
    axis: [axis[0], axis[1]],
    wet: fields.wet,
    climate: sky.climate.id,
    temperature: sky.temperature,
    rainfall: sky.rainfall,
    elevation,
    ...cover,
  };
}

type Gen = EngineContent['terrain']['generator'];

interface Lookups {
  kindIndex(id: string): number;
  biomeIndex(id: string): number;
}

/** Terrain kind and biome indices by id, refusing an id content does not have. */
function lookups(content: EngineContent): Lookups {
  const kinds = new Map(content.terrain.kinds.map((k, i) => [k.id, i]));
  const biomeIds = new Map(content.biomes.biomes.map((b, i) => [b.id, i]));
  return {
    kindIndex(id) {
      const i = kinds.get(id);
      if (i === undefined) throw new Error(`Terrain "${id}" is not a terrain kind.`);
      return i;
    },
    biomeIndex(id) {
      const i = biomeIds.get(id);
      if (i === undefined) throw new Error(`Biome "${id}" is not a biome.`);
      return i;
    },
  };
}

interface Sky {
  climate: Gen['climates'][number];
  temperature: number;
  rainfall: number;
  floor: number;
  relief: number;
}

/** The climate (the region's, or drawn by weight), its temperature and rain, and the valley's heights. */
function drawClimate(rng: RngStream, gen: Gen, climateId: string | undefined): Sky {
  const climate =
    gen.climates.find((c) => c.id === climateId) ??
    rng.weighted(gen.climates.map((c) => [c, Math.round(c.weight * 10)] as const));
  const temperature = draw(rng, climate.temperature);
  const rainfall = Math.round(draw(rng, climate.rainfall));
  const floor = Math.round(draw(rng, gen.elevation.floor));
  const relief = Math.round(draw(rng, gen.elevation.relief));
  return { climate, temperature, rainfall, floor, relief };
}

interface Fields {
  rough: number[];
  bend: number[];
  wet: number[];
  ridge: number[];
  soil: number[];
  crags: number[];
}

/** The six noise fields the ground is made from, drawn in their fixed order. */
function drawFields(rng: RngStream, gen: Gen, width: number, height: number): Fields {
  const { cell, octaves } = gen.noise;
  const field = (size: number, oct: number): number[] =>
    bake(fractalNoise(rng, width, height, size, oct), width, height);
  const rough = field(cell, octaves);
  const bend = field(cell * 3, 2);
  const wet = field(gen.moisture.cell, 3);
  const ridge = field(gen.ridges.cell, 3);
  const soil = field(cell / 2, 2);
  const crags = field(gen.rock.outcropCell, 3);
  return { rough, bend, wet, ridge, soil, crags };
}

/** Height before the massifs: a trough along the axis, roughened, with spurs on the slopes. */
function troughOf(
  gen: Gen,
  fields: Fields,
  [ax, ay]: readonly [number, number],
  { floor, relief }: Sky,
  width: number,
  height: number,
): number[] {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const half = Math.min(width, height) / 2;
  const elevation = new Array<number>(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      // Distance across the axis, 0 on the valley floor's line and about 1 at the map's sides.
      const across = ((x - cx) * ay - (y - cy) * ax) / half;
      const off = across + (fields.bend[i]! - 0.5) * 2 * gen.elevation.axisNoise;
      const trough = clamp(off * off, 0, 1.5);
      // Ridged noise (high along its zero lines) on the slopes: spurs and saddles in the walls.
      const spur = (1 - Math.abs(2 * fields.ridge[i]! - 1)) * clamp(trough, 0, 1);
      elevation[i] =
        floor + relief * (0.6 * trough + 0.4 * fields.rough[i]! + gen.ridges.weight * spur);
    }
  return elevation;
}

interface Heights {
  outcropFrom: number;
  lowland: number;
  valleyFloor: number;
  wallFrom: number;
  screeFrom: number;
  snowFrom: number;
}

/** The heights each band starts at. Rock from a height above the valley floor, so big mountains
 * add rock, held between the `wall` shares of the map; scree is the next `scree` share below it. */
function heightsOf(gen: Gen, elevation: readonly number[], crags: readonly number[]): Heights {
  const outcropFrom = quantile(crags, 1 - gen.rock.outcrops);
  const lowland = quantile(elevation, gen.swampLowland);
  const valleyFloor = quantile(elevation, gen.valleyFloor);
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
  return { outcropFrom, lowland, valleyFloor, wallFrom, screeFrom, snowFrom };
}

interface Laid {
  sky: Sky;
  fields: Fields;
  heights: Heights;
  elevation: readonly number[];
  peaks: Mountains;
  wallRock: number;
}

type Cover = Pick<Ground, 'biomes' | 'fertility' | 'tiles' | 'snow'>;

/** Every tile's biome, then its rock or floor, snow and fertility. */
function coverAll(content: EngineContent, look: Lookups, laid: Laid): Cover {
  const n = laid.elevation.length;
  const cover: Cover = {
    tiles: new Array<number>(n),
    biomes: new Array<number>(n),
    fertility: new Array<number>(n),
    snow: new Array<number>(n).fill(0),
  };
  for (let i = 0; i < n; i += 1) coverTile(content, look, laid, cover, i);
  return cover;
}

function coverTile(
  content: EngineContent,
  look: Lookups,
  laid: Laid,
  cover: Cover,
  i: number,
): void {
  const gen = content.terrain.generator;
  const { sky, fields, heights } = laid;
  const e = laid.elevation[i]!;
  const t = sky.temperature - (gen.elevation.lapse * (e - heights.valleyFloor)) / 1000;
  const low = e <= heights.lowland;
  const wet = gen.moisture.low + gen.moisture.span * fields.wet[i]!;
  const rain = sky.rainfall * wet + (low ? gen.lowlandRain : 0);
  const b = biomeAt(content, look, { e, t, rain, low });
  cover.biomes[i] = b;
  // Rock: the heights, plus a scatter of crags standing out of the valley floor.
  if (e >= heights.wallFrom || fields.crags[i]! >= heights.outcropFrom) {
    const own = laid.peaks.rock[i];
    cover.tiles[i] = own ? look.kindIndex(own) : laid.wallRock;
    if (t < gen.rock.snowline && e >= heights.snowFrom) cover.snow[i] = 1;
    cover.fertility[i] = 0;
    return;
  }
  const biome = content.biomes.biomes[b]!;
  const scree = e >= heights.screeFrom;
  const floorKind = content.terrain.floors[biome.id] ?? content.terrain.surface.ground;
  cover.tiles[i] = scree ? look.kindIndex(gen.rock.screeKind) : look.kindIndex(floorKind);
  const base = biome.fertility * (0.7 + 0.6 * fields.soil[i]!);
  cover.fertility[i] = Math.round(clamp(scree ? base / 4 : base, 0, 100));
}

/** The biome from the temperature-by-rainfall table, or alpine up high, or swamp in wet lowland. */
function biomeAt(
  content: EngineContent,
  look: Lookups,
  { e, t, rain, low }: { e: number; t: number; rain: number; low: boolean },
): number {
  const { rules } = content.biomes;
  const gen = content.terrain.generator;
  if (e >= rules.alpineElevation) return look.biomeIndex(gen.alpine);
  if (low && rain >= rules.swampRainfall && t >= rules.swampMinTemp)
    return look.biomeIndex(gen.swamp);
  return look.biomeIndex(
    rules.table[band(t, rules.temperatureBands)]![band(rain, rules.rainfallBands)]!,
  );
}
