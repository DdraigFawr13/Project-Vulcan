// The region and the valleys on offer, as the page draws them (P1.5): the engine's region less its
// cells, and each candidate valley's map in brief with a thumbnail. Reads worlds; never steps one.
import type { Content } from '../content/index.ts';
import type { Region, WorldState } from '../engine/index.ts';
import type { RegionView, ValleyPreview } from './protocol.ts';

export function regionView(region: Region): RegionView {
  if (!region.raster) throw new Error('The region was rolled without its raster.');
  return {
    seed: region.seed,
    width: region.width,
    height: region.height,
    ranges: region.ranges.flatMap((g) =>
      g.label ? [{ name: g.name, x: g.label[0], y: g.label[1] }] : [],
    ),
    rivers: region.rivers,
    sites: region.sites,
    valleys: region.valleys,
    raster: region.raster,
  };
}

/** Valley `id`'s world as made, before its first tick, in brief. */
export function previewOf(world: WorldState, id: number, content: Content): ValleyPreview {
  const { map } = world;
  const n = map.width * map.height;
  const counts = new Map<number, number>();
  for (const b of map.biomes) counts.set(b, (counts.get(b) ?? 0) + 1);
  const biomes = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 2)
    .map(
      ([b, c]) => `${content.biomes.biomes[b]!.name.toLowerCase()} ${Math.round((100 * c) / n)}%`,
    );
  const watered = world.log.find((e) => e.type === 'map.watered')?.data ?? {};
  const school = (id: string): string => content.schools.find((s) => s.id === id)?.name ?? id;
  return {
    id,
    temperature: map.temperature,
    rainfall: map.rainfall,
    biomes,
    lakes: Number(watered['lakes'] ?? 0),
    springs: Number(watered['springs'] ?? 0),
    aura: map.auraSpots.filter((s) => s.z === 0).map((s) => school(s.school)),
    thumb: {
      width: map.width,
      height: map.height,
      tiles: Uint8Array.from(map.tiles),
      biomes: map.biomes.slice(),
      trees: Uint8Array.from(map.features, (f) =>
        f > 0 && content.features[f - 1]!.kind === 'tree' ? 1 : 0,
      ),
      snow: map.snow.slice(),
    },
  };
}

/** The buffers to transfer with a picker message. */
export const pickerBuffers = (region: RegionView, valleys: ValleyPreview[]): ArrayBuffer[] => [
  region.raster.biome.buffer as ArrayBuffer,
  region.raster.height8.buffer as ArrayBuffer,
  ...valleys.flatMap((v) =>
    [v.thumb.tiles, v.thumb.biomes, v.thumb.trees, v.thumb.snow].map(
      (a) => a.buffer as ArrayBuffer,
    ),
  ),
];
