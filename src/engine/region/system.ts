// The region in the ledger: when a world begins from a valley seed (`<seed>/<n>`), two lines name
// the region and the valley chosen and its neighbours. A plain seed has no region (tests, tools).
import type { EngineContent } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import type { System } from '../sim/index.ts';
import { makeRegion, type Region, type RegionValley } from './region.ts';

/** The region seed and valley number a world seed names, or undefined for a plain seed. */
export function siteOf(seed: string): { region: string; site: number } | undefined {
  const m = /^(.+)\/([1-9])$/.exec(seed);
  return m ? { region: m[1]!, site: Number(m[2]) } : undefined;
}

/** The valley a world seed settles, with its region, or undefined for a plain seed. */
export function valleyOf(
  seed: string,
  content: EngineContent,
): { region: Region; valley: RegionValley } | undefined {
  const at = siteOf(seed);
  if (!at) return undefined;
  const region = makeRegion(at.region, content);
  const valley = region.valleys[at.site - 1];
  return valley && { region, valley };
}

const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

export const regionSystem: System = {
  id: 'region',
  every: 'month', // a cadence is required; the region has no work after the world begins
  emits: ['region.named', 'region.settled'],
  // The settlement the band makes, named for its valley, so screens need not roll the region again.
  tables: { colony: { name: 'text', settled: 'event' } },
  init(ctx) {
    const found = valleyOf(ctx.world.seed, ctx.content);
    if (!found) return;
    const { region, valley } = found;
    const labelled = region.ranges.filter((g) => g.label).map((g) => g.name);
    ctx.emit('region.named', {
      causes: [ctx.world.begunEvent],
      data: {
        region: siteOf(ctx.world.seed)!.region,
        places: list([...labelled, ...region.rivers.map((r) => r.name)]) || 'no named heights',
        sites: region.sites.length,
      },
    });
    const climate = ctx.content.terrain.generator.climates.find((c) => c.id === valley.climate);
    const settled = ctx.emit('region.settled', {
      // World-generation lines cite the world's beginning alone, so they offer no "why?".
      causes: [ctx.world.begunEvent],
      data: {
        valley: valley.name,
        under: valley.range ? `, under ${valley.range}` : '',
        climate: climate?.name ?? valley.climate,
        neighbours: list(
          valley.near.map((n) => `${n.name} of the ${n.culture} (${n.days} days ${n.dir})`),
        ),
      },
    });
    addEntity(ctx.world, 'colony', { name: valley.name, settled });
  },
};
