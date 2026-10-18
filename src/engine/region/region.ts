// The lighter world map (P1.5, DECISIONS V-017): a small region rolled from the seed on its own
// `region` stream, with named ranges and rivers, six to eight neighbouring sites of the content
// cultures and three valleys to settle. Pure: same seed and content, same region (V-006).
import { streamFor, type EngineContent } from '../core/index.ts';
import { band, clamp, layRivers, nameRanges, noise, RAYS } from './land.ts';
import { compass, dayDistance, placeName, valeName } from './names.ts';

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
  kind: string;
  government: string;
  faith: string;
  biome: string;
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
  const dials = content.region;
  const { width: W, height: H } = dials.grid;
  const rules = content.biomes.rules;
  const forest = new Set(content.biomes.biomes.filter((b) => b.forest).map((b) => b.id));
  const rng = streamFor({ seed, rng: {} }, 'region');
  const n1 = noise(rng, W, H, dials.noise.height);
  const n2 = noise(rng, W, H, dials.noise.detail);
  const n3 = noise(rng, W, H, dials.noise.rain);
  const north = rng.between(dials.warmth.north[0]! * 10, dials.warmth.north[1]! * 10) / 10;

  const biomeOf = (t: number, r: number, e: number): string => {
    if (e < dials.lake) return 'lake';
    if (e > dials.alpine) return 'alpine';
    const b = rules.table[band(t, rules.temperatureBands)]![band(r, rules.rainfallBands)]!;
    if (r > rules.swampRainfall && t > rules.swampMinTemp && e < 0.25) return 'swamp';
    return rules.frostFree.fallback[b] ?? b;
  };
  const field = (x: number, y: number): RegionCell => {
    const { detailWeight: dw, floor, stretch } = dials.noise;
    const e = clamp(((1 - dw) * n1(x, y) + dw * n2(x, y) - floor) * stretch, 0, 1);
    const t =
      north +
      dials.warmth.span * (y / (H - 1)) -
      dials.warmth.lapse * Math.max(0, e - dials.warmth.from);
    const r = dials.rain.base + dials.rain.span * n3(x, y) + dials.rain.west * (1 - x / W);
    return { e, t, r, biome: biomeOf(t, r, e) };
  };
  const cells: RegionCell[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) cells.push(field(x, y));
  const at = (x: number, y: number): RegionCell => cells[y * W + x]!;
  const inside = (x: number, y: number, inset = 0): boolean =>
    x >= inset && y >= inset && x < W - inset && y < H - inset;
  const mountain = (c: RegionCell): boolean => c.e > dials.mountain;

  const rivers = layRivers(rng, content, cells, W, H);
  const riverAt = new Set(rivers.flatMap((r) => r.path.map(([x, y]) => y * W + x)));
  const ranges = nameRanges(rng, content, cells, W, H);

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
      const left = spare.filter((i) =>
        chosen.every((v) => far(v, i % W, Math.floor(i / W), dials.valleys.spacing * 0.7)),
      );
      if (!left.length) break;
      const i = rng.pick(left);
      chosen.push({ x: i % W, y: Math.floor(i / W), climate: bestClimate(cells[i]!) });
    }
  }

  // Neighbouring sites: each picks a culture by how well the spot suits it, repeats discouraged.
  const S = dials.sites;
  const count = rng.between(S.count[0]!, S.count[1]!);
  const used = new Map<string, number>();
  const sites: RegionSite[] = [];
  const suits = (cu: (typeof content.cultures)[number], c: RegionCell, i: number): number =>
    (cu.preferredBiomes.includes(c.biome) ? 3 : 0.15) +
    cu.sitePreferences.reduce(
      (s, p) =>
        s +
        (p === 'river' && riverAt.has(i) ? 2 : 0) +
        (p === 'heights' && c.e > 0.5 ? 2 : 0) +
        (p === 'plains' && c.e < 0.3 && !forest.has(c.biome) ? 1.5 : 0) +
        (p === 'forest' && forest.has(c.biome) ? 1.5 : 0) +
        (p === 'deposit' && c.e > 0.55 ? 1 : 0),
      0,
    );
  for (let tries = 0; sites.length < count && tries < 600; tries += 1) {
    const i = rng.int(cells.length);
    const x = i % W;
    const y = (i - x) / W;
    const c = cells[i]!;
    if (c.biome === 'lake' || c.biome === 'alpine' || !inside(x, y, S.inset)) continue;
    if (![...chosen, ...sites].every((v) => far(v, x, y, S.spacing))) continue;
    const culture = rng.weighted(
      content.cultures.map(
        (cu) =>
          [cu, Math.round((100 * suits(cu, c, i)) / (1 + 2 * (used.get(cu.id) ?? 0)))] as const,
      ),
    );
    used.set(culture.id, (used.get(culture.id) ?? 0) + 1);
    const taken = new Set(sites.map((s) => s.name));
    const name = unique(taken, () => placeName(rng, culture));
    sites.push({
      name,
      x,
      y,
      culture: culture.name,
      race: content.races.find((r) => r.id === culture.raceId)?.name ?? culture.raceId,
      kind: dials.kinds[culture.raceId] ?? 'village',
      government: culture.government,
      faith: culture.religion.name,
      biome: c.biome,
    });
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
      .slice(0, S.near);
    const home =
      content.cultures.find((cu) => cu.name === near[0]?.s.culture) ?? content.cultures[0]!;
    const name = unique(names, () => valeName(rng, home, dials.vales));
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

  const region: Region = { seed, width: W, height: H, cells, ranges, rivers, sites, valleys };
  if (withRaster) region.raster = raster(content, field, W, H);
  return region;
}

/** The fields sampled `SCALE` times per cell, for the picker's drawing. */
const SCALE = 4;
function raster(
  content: EngineContent,
  field: (x: number, y: number) => RegionCell,
  W: number,
  H: number,
): NonNullable<Region['raster']> {
  const ids = new Map(content.biomes.biomes.map((b, i) => [b.id, i]));
  const width = W * SCALE;
  const height = H * SCALE;
  const biome = new Uint8Array(width * height);
  const height8 = new Uint8Array(width * height);
  for (let py = 0; py < height; py += 1)
    for (let px = 0; px < width; px += 1) {
      const f = field((px + 0.5) / SCALE - 0.5, (py + 0.5) / SCALE - 0.5);
      biome[py * width + px] = ids.get(f.biome) ?? 0;
      height8[py * width + px] = Math.round(f.e * 255);
    }
  return { scale: SCALE, width, height, biome, height8 };
}
