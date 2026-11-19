// The region around the valley (P1.5's screen, P1.6's source, DECISIONS V-031): a window of the
// seed's Story Generator world, with its named ranges and rivers, six to eight of its live sites and
// three valleys to settle. Pure: same seed and content, same world and region (V-006).
import { streamFor, type EngineContent, type RngStream } from '../core/index.ts';
import { ground, windows, type Window } from './ground.ts';
import { clamp, RAYS } from './land.ts';
import { compass, dayDistance, valeName } from './names.ts';
import { rangesIn, riversIn, sitesIn } from './places.ts';
import { storyWorld, type WorldState } from './story.ts';

/** One grid cell's height (0 to 1), warmth (degrees C), rain (mm) and biome id. */
export interface RegionCell {
  e: number;
  t: number;
  r: number;
  biome: string;
}

export interface RegionRange {
  name: string;
  /** Its highest cell. */
  x: number;
  y: number;
  size: number;
  /** Where the map writes its name, or absent when it is not written (too small or crowded). */
  label?: readonly [number, number];
}

export interface RegionSite {
  name: string;
  x: number;
  y: number;
  culture: string;
  race: string;
  /** The world's word for it: hamlet, village, town, city, fortress, hold, mine, temple or port. */
  kind: string;
  /** Its map glyph, by its people's race (region.json `kinds`: village, hold, warren). */
  glyph: string;
  /** Its realm's way of rule (the realm's people's government), or its own people's with none. */
  government: string;
  faith: string;
  biome: string;
  people: number;
  /** The history year it was founded, 0 for the first settlements. */
  founded: number;
  /** The realm it belongs to, or '' for none. */
  realm: string;
  /** Its most telling event, in the Story Generator's words, or '' when nothing of note happened. */
  history: string;
}

export interface RegionNeighbour {
  name: string;
  culture: string;
  kind: string;
  /** Compass word from the valley (north, south-east). */
  dir: string;
  days: number;
}

export interface RegionValley {
  /** 1 to `valleys.count`: the world seed `<seed>/<id>` settles it. */
  id: number;
  name: string;
  x: number;
  y: number;
  /** A terrain.json climate id, which the map generator then uses. */
  climate: string;
  /** The nearest range written on the map, if any. */
  range: string;
  river: string;
  near: RegionNeighbour[];
}

export interface Region {
  seed: string;
  width: number;
  height: number;
  /** Row by row, `y * width + x`. */
  cells: RegionCell[];
  ranges: RegionRange[];
  rivers: { name: string; path: (readonly [number, number])[] }[];
  sites: RegionSite[];
  valleys: RegionValley[];
  /** The fields at `scale` points per cell, for drawing: biome index into content biomes and
   * height 0 to 255, row by row. Only when asked for (the worker's picker and Region panel). */
  raster?: { scale: number; width: number; height: number; biome: Uint8Array; height8: Uint8Array };
}

/** Rolls the region for `seed` (the player's seed, without a valley number). */
/** A name not yet taken: drawn again up to 50 times, then numbered so the loop always ends. */
function unique(taken: ReadonlySet<string>, draw: () => string): string {
  let name = draw();
  for (let tries = 0; taken.has(name) && tries < 50; tries += 1) name = draw();
  for (let n = 2; taken.has(name); n += 1) name = `${name.replace(/ \d+$/, '')} ${n}`;
  return name;
}

export function makeRegion(seed: string, content: EngineContent, withRaster = false): Region {
  const world = storyWorld(seed, content);
  let made = chosen.get(world);
  if (!made) {
    made = bestRegion(seed, world, content);
    chosen.set(world, made);
  }
  // A copy, so a caller adding the raster or changing a field never changes the kept region.
  const region: Region = { ...made.region };
  if (withRaster) region.raster = raster(made.field, region.width, region.height);
  return region;
}

// The region chosen for each world made (its window search takes about as long as the world).
const chosen = new WeakMap<WorldState, { region: Region; field: Field }>();

function bestRegion(
  seed: string,
  world: WorldState,
  content: EngineContent,
): { region: Region; field: Field } {
  // The best window with two or more peoples whose valleys get a climate each; failing that, the
  // most peoples-then-climates, best window first.
  const want = content.region.valleys.count;
  const spread = (r: Region): number =>
    (new Set(r.sites.map((s) => s.culture)).size > 1 ? 10 : 0) +
    new Set(r.valleys.map((v) => v.climate)).size;
  let best: { region: Region; field: Field } | undefined;
  for (const win of windows(world, content)) {
    const made = regionIn(seed, world, win, content);
    if (!best || spread(made.region) > spread(best.region)) best = made;
    if (spread(best.region) === 10 + want) break;
  }
  return best!;
}

type Field = ReturnType<typeof ground>['field'];

/** The region a window of the world makes: its ground, places and three valleys. */
function regionIn(
  seed: string,
  world: WorldState,
  win: Window,
  content: EngineContent,
): { region: Region; field: Field } {
  const dials = content.region;
  const { width: W, height: H } = dials.grid;
  const rng = streamFor({ seed, rng: {} }, 'region');
  const { field, shift } = ground(world, win, content, rng);
  const cells: RegionCell[] = [];
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const { e, t, r, biome } = field(x, y);
      cells.push({ e, t, r, biome });
    }
  const g: Grid = { cells, W, H, dials, climates: content.terrain.generator.climates };
  const rivers = riversIn(world, win, content, shift);
  const ranges = rangesIn(world, win, content);
  const sites = sitesIn(
    world,
    win,
    content,
    (x, y) => at(g, clamp(x, 0, W - 1), clamp(y, 0, H - 1)).biome,
  );
  const chosen = chooseValleys(g, sites, rng);
  labelRanges(g, ranges, sites);
  const names = new Set<string>();
  const valleys = chosen.map((v, k) =>
    valleyAt(content, g, { sites, ranges, rivers }, { v, k, names, rng }),
  );
  return { region: { seed, width: W, height: H, cells, ranges, rivers, sites, valleys }, field };
}

/** The region's cells and the dials its valleys are chosen by. */
interface Grid {
  cells: RegionCell[];
  W: number;
  H: number;
  dials: EngineContent['region'];
  climates: EngineContent['terrain']['generator']['climates'];
}

type Climate = Grid['climates'][number];
type Chosen = { x: number; y: number; climate: string };

const at = (g: Grid, x: number, y: number): RegionCell => g.cells[y * g.W + x]!;
const inside = (g: Grid, x: number, y: number, inset = 0): boolean =>
  x >= inset && y >= inset && x < g.W - inset && y < g.H - inset;
const far = (a: { x: number; y: number }, x: number, y: number, d: number): boolean =>
  Math.abs(a.x - x) + Math.abs(a.y - y) >= d;

/** How many of the eight rays from a cell meet mountain within `valleys.reach`. */
function walls(g: Grid, x: number, y: number): number {
  return RAYS.filter(([dx, dy]) => {
    for (let k = 2; k <= g.dials.valleys.reach; k += 1)
      if (inside(g, x + dx * k, y + dy * k) && at(g, x + dx * k, y + dy * k).e > g.dials.mountain)
        return true;
    return false;
  }).length;
}

/** True when a lake lies within three cells. */
function wet(g: Grid, x: number, y: number): boolean {
  for (let dy = -3; dy <= 3; dy += 1)
    for (let dx = -3; dx <= 3; dx += 1)
      if (inside(g, x + dx, y + dy) && at(g, x + dx, y + dy).biome === 'lake') return true;
  return false;
}

/** Low inland cells, not swamp nor beside a lake, walled by heights on `minWalls` sides. */
function pool(g: Grid, minWalls: number): number[] {
  const [lo, hi] = g.dials.valleys.low as [number, number];
  return g.cells
    .map((_, i) => i)
    .filter((i) => {
      const x = i % g.W;
      const y = (i - x) / g.W;
      const c = g.cells[i]!;
      if (!inside(g, x, y, g.dials.valleys.inset) || c.e <= lo || c.e >= hi) return false;
      return c.biome !== 'swamp' && !wet(g, x, y) && walls(g, x, y) >= minWalls;
    });
}

function misfit(g: Grid, c: RegionCell, cl: Climate): number {
  return (
    Math.max(0, cl.temperature[0]! - c.t, c.t - cl.temperature[1]!) / g.dials.valleys.dry +
    Math.max(0, cl.rainfall[0]! - c.r, c.r - cl.rainfall[1]!) / 150
  );
}

const bestClimate = (g: Grid, c: RegionCell): string =>
  g.climates.reduce((m, q) => (misfit(g, c, q) < misfit(g, c, m) ? q : m)).id;

/** Valleys: low inland cells walled by heights on several sides, away from lakes, one per
 * climate where the region has ground for it; fewer than three found, the best walled low
 * ground left, then any low inland ground. */
function chooseValleys(g: Grid, sites: readonly RegionSite[], rng: RngStream): Chosen[] {
  const chosen: Chosen[] = [];
  const strict = pool(g, g.dials.valleys.walls);
  for (const cl of g.climates) {
    if (chosen.length === g.dials.valleys.count) break;
    const best = bestFor(g, cl, strict, { chosen, sites, rng });
    if (best >= 0)
      chosen.push({
        x: best % g.W,
        y: Math.floor(best / g.W),
        climate: bestClimate(g, g.cells[best]!),
      });
  }
  for (const minWalls of [2, 0]) spareValleys(g, pool(g, minWalls), chosen, sites, rng);
  return chosen;
}

/** The strict cell that best fits climate `cl`, spaced from the valleys chosen and the sites. */
function bestFor(
  g: Grid,
  cl: Climate,
  strict: readonly number[],
  { chosen, sites, rng }: { chosen: Chosen[]; sites: readonly RegionSite[]; rng: RngStream },
): number {
  let best = -1;
  let bestScore = Infinity;
  for (const i of strict) {
    const x = i % g.W;
    const y = (i - x) / g.W;
    if (!chosen.every((v) => far(v, x, y, g.dials.valleys.spacing))) continue;
    if (!sites.every((v) => far(v, x, y, g.dials.valleys.clear))) continue;
    const score = misfit(g, g.cells[i]!, cl) - 0.15 * walls(g, x, y) + rng.int(200) / 1000;
    if (score < bestScore) [best, bestScore] = [i, score];
  }
  return best;
}

/** Draws valleys from `spare` until there are enough or none is left far enough apart. */
function spareValleys(
  g: Grid,
  spare: readonly number[],
  chosen: Chosen[],
  sites: readonly RegionSite[],
  rng: RngStream,
): void {
  const { spacing, clear } = g.dials.valleys;
  while (chosen.length < g.dials.valleys.count) {
    const left = spare.filter((i) => {
      const [x, y] = [i % g.W, Math.floor(i / g.W)];
      return (
        chosen.every((v) => far(v, x, y, spacing * 0.7)) && sites.every((v) => far(v, x, y, clear))
      );
    });
    if (!left.length) break;
    const i = rng.pick(left);
    chosen.push({ x: i % g.W, y: Math.floor(i / g.W), climate: bestClimate(g, g.cells[i]!) });
  }
}

/** Labels: the biggest ranges first, kept clear of the sites and of each other. */
function labelRanges(g: Grid, ranges: RegionRange[], sites: readonly RegionSite[]): void {
  const spots = sites.map((s) => [s.x, s.y] as const);
  for (const r of [...ranges].sort((a, b) => b.size - a.size)) {
    const half = Math.ceil(r.name.length * 0.6);
    const lx = clamp(r.x, half + 1, g.W - half - 1);
    const ly = clamp(r.y + 2, 3, g.H - 2);
    if (
      r.size >= g.dials.ranges.label &&
      spots.every(([a, b]) => Math.abs(a - lx) > 17 || Math.abs(b - ly) > 4)
    ) {
      r.label = [lx, ly];
      spots.push([lx, ly]);
    }
  }
}

/** A chosen valley named after its nearest people, with its nearest range, river and sites. */
function valleyAt(
  content: EngineContent,
  g: Grid,
  places: Pick<Region, 'sites' | 'ranges' | 'rivers'>,
  { v, k, names, rng }: { v: Chosen; k: number; names: Set<string>; rng: RngStream },
): RegionValley {
  const { dials } = g;
  const near = places.sites
    .map((s) => ({ s, d: dayDistance(s.x - v.x, s.y - v.y) }))
    .sort((a, b) => a.d - b.d || a.s.name.length - b.s.name.length)
    .slice(0, dials.sites.near);
  const home =
    content.cultures.find((cu) => cu.name === near[0]?.s.culture) ?? content.cultures[0]!;
  const name = unique(names, () => valeName(rng, home, dials.valesBy[home.id] ?? dials.vales));
  names.add(name);
  const range = places.ranges
    .filter((r) => r.label)
    .map((r) => ({ r, d: dayDistance(r.x - v.x, r.y - v.y) }))
    .sort((a, b) => a.d - b.d)[0]?.r.name;
  const river = places.rivers.find((r) =>
    r.path.some(([x, y]) => Math.abs(x - v.x) + Math.abs(y - v.y) <= 3),
  );
  return {
    id: k + 1,
    ...{ name, x: v.x, y: v.y, climate: v.climate },
    range: range ?? '',
    river: river?.name ?? '',
    near: near.map(({ s, d }) => ({
      ...{ name: s.name, culture: s.culture, kind: s.kind },
      dir: compass(s.x - v.x, s.y - v.y),
      days: Math.max(1, Math.round(d * dials.daysPerCell)),
    })),
  };
}

/** The fields sampled `SCALE` times per cell, for the picker's drawing. */
const SCALE = 4;
function raster(
  field: (x: number, y: number) => RegionCell & { index: number },
  W: number,
  H: number,
): NonNullable<Region['raster']> {
  const width = W * SCALE;
  const height = H * SCALE;
  const biome = new Uint8Array(width * height);
  const height8 = new Uint8Array(width * height);
  for (let py = 0; py < height; py += 1)
    for (let px = 0; px < width; px += 1) {
      const f = field((px + 0.5) / SCALE - 0.5, (py + 0.5) / SCALE - 0.5);
      biome[py * width + px] = f.index;
      height8[py * width + px] = Math.round(f.e * 255);
    }
  return { scale: SCALE, width, height, biome, height8 };
}
