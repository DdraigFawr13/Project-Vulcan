// The region around the valley (P1.5's screen, P1.6's source, DECISIONS V-031): a window of the
// seed's Story Generator world, with its named ranges and rivers, six to eight of its live sites and
// three valleys to settle. Pure: same seed and content, same world and region (V-006).
import { streamFor, type EngineContent } from '../core/index.ts';
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
  const at = (x: number, y: number): RegionCell => cells[y * W + x]!;
  const inside = (x: number, y: number, inset = 0): boolean =>
    x >= inset && y >= inset && x < W - inset && y < H - inset;
  const mountain = (c: RegionCell): boolean => c.e > dials.mountain;

  const rivers = riversIn(world, win, content, shift);
  const ranges = rangesIn(world, win, content);
  const sites = sitesIn(
    world,
    win,
    content,
    (x, y) => at(clamp(x, 0, W - 1), clamp(y, 0, H - 1)).biome,
  );

  // Valleys: low inland cells walled by heights on several sides, away from lakes, one per climate
  // where the region has ground for it.
  const walls = (x: number, y: number): number =>
    RAYS.filter(([dx, dy]) => {
      for (let k = 2; k <= dials.valleys.reach; k += 1)
        if (inside(x + dx * k, y + dy * k) && mountain(at(x + dx * k, y + dy * k))) return true;
      return false;
    }).length;
  const wet = (x: number, y: number): boolean => {
    for (let dy = -3; dy <= 3; dy += 1)
      for (let dx = -3; dx <= 3; dx += 1)
        if (inside(x + dx, y + dy) && at(x + dx, y + dy).biome === 'lake') return true;
    return false;
  };
  const [lo, hi] = dials.valleys.low as [number, number];
  const pool = (minWalls: number): number[] =>
    cells
      .map((_, i) => i)
      .filter((i) => {
        const x = i % W;
        const y = (i - x) / W;
        const c = cells[i]!;
        return (
          inside(x, y, dials.valleys.inset) &&
          c.e > lo &&
          c.e < hi &&
          c.biome !== 'swamp' &&
          !wet(x, y) &&
          walls(x, y) >= minWalls
        );
      });
  const climates = content.terrain.generator.climates;
  const misfit = (c: RegionCell, cl: (typeof climates)[number]): number =>
    Math.max(0, cl.temperature[0]! - c.t, c.t - cl.temperature[1]!) / dials.valleys.dry +
    Math.max(0, cl.rainfall[0]! - c.r, c.r - cl.rainfall[1]!) / 150;
  const bestClimate = (c: RegionCell): string =>
    climates.reduce((m, q) => (misfit(c, q) < misfit(c, m) ? q : m)).id;
  const far = (a: { x: number; y: number }, x: number, y: number, d: number): boolean =>
    Math.abs(a.x - x) + Math.abs(a.y - y) >= d;
  const chosen: { x: number; y: number; climate: string }[] = [];
  const strict = pool(dials.valleys.walls);
  for (const cl of climates) {
    if (chosen.length === dials.valleys.count) break;
    let best = -1;
    let bestScore = Infinity;
    for (const i of strict) {
      const x = i % W;
      const y = (i - x) / W;
      if (!chosen.every((v) => far(v, x, y, dials.valleys.spacing))) continue;
      if (!sites.every((v) => far(v, x, y, dials.valleys.clear))) continue;
      const score = misfit(cells[i]!, cl) - 0.15 * walls(x, y) + rng.int(200) / 1000;
      if (score < bestScore) [best, bestScore] = [i, score];
    }
    if (best >= 0)
      chosen.push({ x: best % W, y: Math.floor(best / W), climate: bestClimate(cells[best]!) });
  }
  // Fewer than three found: take the best walled low ground left, then any low inland ground.
  for (const minWalls of [2, 0]) {
    const spare = pool(minWalls);
    while (chosen.length < dials.valleys.count) {
      const left = spare.filter(
        (i) =>
          chosen.every((v) => far(v, i % W, Math.floor(i / W), dials.valleys.spacing * 0.7)) &&
          sites.every((v) => far(v, i % W, Math.floor(i / W), dials.valleys.clear)),
      );
      if (!left.length) break;
      const i = rng.pick(left);
      chosen.push({ x: i % W, y: Math.floor(i / W), climate: bestClimate(cells[i]!) });
    }
  }

  // Labels: the biggest ranges first, kept clear of the sites and of each other.
  const spots = sites.map((s) => [s.x, s.y] as const);
  for (const g of [...ranges].sort((a, b) => b.size - a.size)) {
    const half = Math.ceil(g.name.length * 0.6);
    const lx = clamp(g.x, half + 1, W - half - 1);
    const ly = clamp(g.y + 2, 3, H - 2);
    if (
      g.size >= dials.ranges.label &&
      spots.every(([a, b]) => Math.abs(a - lx) > 17 || Math.abs(b - ly) > 4)
    ) {
      g.label = [lx, ly];
      spots.push([lx, ly]);
    }
  }

  const names = new Set<string>();
  const valleys: RegionValley[] = chosen.map((v, k) => {
    const near = sites
      .map((s) => ({ s, d: dayDistance(s.x - v.x, s.y - v.y) }))
      .sort((a, b) => a.d - b.d || a.s.name.length - b.s.name.length)
      .slice(0, dials.sites.near);
    const home =
      content.cultures.find((cu) => cu.name === near[0]?.s.culture) ?? content.cultures[0]!;
    const name = unique(names, () => valeName(rng, home, dials.valesBy[home.id] ?? dials.vales));
    names.add(name);
    const range = ranges
      .filter((g) => g.label)
      .map((g) => ({ g, d: dayDistance(g.x - v.x, g.y - v.y) }))
      .sort((a, b) => a.d - b.d)[0]?.g.name;
    const river = rivers.find((r) =>
      r.path.some(([x, y]) => Math.abs(x - v.x) + Math.abs(y - v.y) <= 3),
    );
    return {
      id: k + 1,
      name,
      x: v.x,
      y: v.y,
      climate: v.climate,
      range: range ?? '',
      river: river?.name ?? '',
      near: near.map(({ s, d }) => ({
        name: s.name,
        culture: s.culture,
        kind: s.kind,
        dir: compass(s.x - v.x, s.y - v.y),
        days: Math.max(1, Math.round(d * dials.daysPerCell)),
      })),
    };
  });

  return { region: { seed, width: W, height: H, cells, ranges, rivers, sites, valleys }, field };
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
