// Aura (P1.4): a faint background over the surface and a few strong spots, each of one of the six
// schools by the kind of place it forms in (terrain.json `generator.aura.sites`): the highest
// peaks, springs, old-growth woods and the still middles of deep lakes on the surface, and one deep
// spot in a great cavern or an obsidian seam on the deepest level, made when that level is reached.
// Adapted from the Story Generator's worldgen/aura.ts. Integer distances only (V-006).
import type {
  AuraDials,
  AuraSite,
  AuraSpot,
  EngineContent,
  MapState,
  RngStream,
} from '../core/index.ts';
import { WATER } from '../core/index.ts';
import { bake, fractalNoise, quantile } from './noise.ts';

const LAKE = WATER.indexOf('lake');
const SPRING = WATER.indexOf('spring');
const AROUND = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
/** Picks give up after this many tries per site kind. */
const TRIES = 30;

/** Distance in whole tiles, near enough to round: the long side plus half the short (no roots). */
export const ringOf = (dx: number, dy: number): number => {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  return a > b ? a + (b >> 1) : b + (a >> 1);
};

/** How many tiles in the square of side 2 * reach + 1 around `i` pass `test`. */
function around(i: number, W: number, reach: number, test: (j: number) => boolean): number {
  let n = 0;
  for (let dy = -reach; dy <= reach; dy += 1)
    for (let dx = -reach; dx <= reach; dx += 1) if (test(i + dy * W + dx)) n += 1;
  return n;
}

/** Up to one spot of each site in `order`, `count` in all, spaced apart, drawn from `rng`. */
function pick(
  rng: RngStream,
  dials: AuraDials,
  candidates: Map<AuraSite, number[]>,
  count: number,
  W: number,
  z: number,
): AuraSpot[] {
  const sites = dials.sites.filter((s) => (candidates.get(s.site)?.length ?? 0) > 0);
  const order: typeof sites = [];
  while (sites.length) order.push(sites.splice(rng.int(sites.length), 1)[0]!);
  const spots: AuraSpot[] = [];
  for (const { site, school } of order) {
    if (spots.length >= count) break;
    const cells = candidates.get(site)!;
    for (let k = 0; k < TRIES; k += 1) {
      const c = rng.pick(cells);
      const x = c % W;
      const y = (c - x) / W;
      const apart = spots.every(
        (s) => Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) >= dials.spacing,
      );
      if (!apart) continue;
      spots.push({
        school,
        site,
        x,
        y,
        z,
        strength: rng.between(dials.strength[0]!, dials.strength[1]!),
      });
      break;
    }
  }
  return spots;
}

/** The background aura layer and the surface spots, drawn from `rng` after the map is laid out. */
export function layAura(
  rng: RngStream,
  content: EngineContent,
  map: MapState,
): { aura: Uint8Array; spots: AuraSpot[] } {
  const dials = content.terrain.generator.aura;
  const W = map.width;
  const H = map.height;
  const field = bake(fractalNoise(rng, W, H, dials.cell, 2), W, H);
  const aura = Uint8Array.from(field, (v) => Math.round(v * dials.base));
  const { kinds } = content.terrain;
  const top = quantile(Array.from(map.elevation), dials.peakShare);
  const isTree = (j: number): boolean =>
    map.features[j]! > 0 && content.features[map.features[j]! - 1]!.kind === 'tree';
  const isDeepLake = (j: number): boolean =>
    map.water[j] === LAKE && kinds[map.tiles[j]!]!.water === 'deep';
  const found = new Map<AuraSite, number[]>(
    (['peak', 'spring', 'wood', 'lake'] as const).map((s) => [s, []]),
  );
  const m = dials.margin;
  for (let y = m; y < H - m; y += 1)
    for (let x = m; x < W - m; x += 1) {
      const i = y * W + x;
      const e = map.elevation[i]!;
      if (e >= top && AROUND.every(([dx, dy]) => map.elevation[i + dy * W + dx]! <= e))
        found.get('peak')!.push(i);
      if (map.water[i] === SPRING) found.get('spring')!.push(i);
      if (isTree(i) && around(i, W, dials.wood.reach, isTree) >= dials.wood.trees)
        found.get('wood')!.push(i);
      const side = 2 * dials.lake + 1;
      if (isDeepLake(i) && around(i, W, dials.lake, isDeepLake) === side * side)
        found.get('lake')!.push(i);
    }
  const surface = { ...dials, sites: dials.sites.filter((s) => !s.deep) };
  const count = rng.between(dials.count[0]!, dials.count[1]!);
  return { aura, spots: pick(rng, surface, found, count, W, 0) };
}

/** The deep level's one spot, from that level's own stream after its rock and veins are laid. */
export function deepSpot(
  rng: RngStream,
  content: EngineContent,
  W: number,
  H: number,
  z: number,
  tiles: Uint8Array,
  features: Uint8Array,
): AuraSpot | undefined {
  const dials = content.terrain.generator.aura;
  if (z !== dials.deepLevel) return undefined;
  const cave = content.terrain.kinds.findIndex(
    (k) => k.id === content.terrain.generator.underground.caves.kind,
  );
  const obsidian = content.features.findIndex((f) => f.id === 'obsidian') + 1;
  const isCave = (j: number): boolean => tiles[j] === cave;
  const found = new Map<AuraSite, number[]>([
    ['cavern', []],
    ['obsidian', []],
  ]);
  const m = dials.margin;
  for (let y = m; y < H - m; y += 1)
    for (let x = m; x < W - m; x += 1) {
      const i = y * W + x;
      if (obsidian > 0 && features[i] === obsidian) found.get('obsidian')!.push(i);
      if (isCave(i) && around(i, W, dials.cavern.reach, isCave) >= dials.cavern.open)
        found.get('cavern')!.push(i);
    }
  const deep = { ...dials, sites: dials.sites.filter((s) => s.deep) };
  return pick(rng, deep, found, 1, W, z)[0];
}

/** Aura at a tile, 0 to 100: the strongest spot reaching it on its level, else the background
 * (the surface only), with the spot that gives it. */
export function auraAt(
  content: EngineContent,
  map: MapState,
  x: number,
  y: number,
  z: number,
): { aura: number; spot: AuraSpot | undefined } {
  const dials = content.terrain.generator.aura;
  let aura = z === 0 ? (map.aura[y * map.width + x] ?? 0) : 0;
  let spot: AuraSpot | undefined;
  for (const s of map.auraSpots) {
    if (s.z !== z) continue;
    const ring = ringOf(s.x - x, s.y - y);
    if (ring > dials.radius) continue;
    const value = s.strength - dials.falloff * ring;
    if (value > aura) {
      aura = value;
      spot = s;
    }
  }
  return { aura, spot };
}

/** "a spring (Water) and the highest peak (Air)": each spot's place and school, for its line. */
export function placesOf(content: EngineContent, spots: readonly AuraSpot[]): string {
  const names = spots.map((s) => {
    const site = content.terrain.generator.aura.sites.find((d) => d.site === s.site)!;
    const school = content.schools.find((d) => d.id === s.school)?.name ?? s.school;
    return `${site.words} (${school})`;
  });
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
