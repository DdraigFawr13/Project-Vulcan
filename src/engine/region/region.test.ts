import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, renderEvent } from '../index.ts';
import { MAP_SEEDS } from '../map/seeds.ts';
import { makeRegion, siteOf } from './index.ts';

// P1.5 and P1.6 done-when: ten seeds give ten distinct, named neighbourhoods drawn from their Story
// Generator worlds, and the same seed gives the same world. Each region has six to eight sites with
// names unique in it, three valleys with distinct names and content climates whose nearest three
// neighbours are 2 to 12 days away, and a valley seed (`<seed>/<n>`) settles that valley with its
// climate and two ledger lines.
describe('region', () => {
  const regions = MAP_SEEDS.map((seed) => makeRegion(seed, content));

  it('gives each seed its own named neighbourhood', () => {
    const climates = new Set(content.terrain.generator.climates.map((c) => c.id));
    const [lo, hi] = content.region.sites.count as [number, number];
    for (const r of regions) {
      const names = r.sites.map((s) => s.name);
      expect(names.length, r.seed).toBeGreaterThanOrEqual(lo);
      expect(names.length, r.seed).toBeLessThanOrEqual(hi);
      expect(new Set(names).size, r.seed).toBe(names.length);
      // Border country: at least two peoples meet in every region.
      expect(new Set(r.sites.map((s) => s.culture)).size, r.seed).toBeGreaterThanOrEqual(2);
      expect(r.valleys.map((v) => v.id)).toEqual([1, 2, 3]);
      expect(new Set(r.valleys.map((v) => v.name)).size, r.seed).toBe(3);
      for (const v of r.valleys) {
        expect(climates.has(v.climate), `${r.seed} ${v.climate}`).toBe(true);
        expect(v.near.length).toBe(content.region.sites.near);
        for (const n of v.near) expect(n.days, `${r.seed} ${v.name}`).toBeGreaterThanOrEqual(2);
        for (const n of v.near) expect(n.days, `${r.seed} ${v.name}`).toBeLessThanOrEqual(12);
      }
    }
    const neighbourhoods = new Set(regions.map((r) => r.sites.map((s) => s.name).join(',')));
    expect(neighbourhoods.size).toBe(MAP_SEEDS.length);
    // The sites are the world's: each has a people, a realm or none, and a line of its history.
    expect(regions.every((r) => r.sites.some((s) => s.realm && s.history))).toBe(true);
  });

  it('makes the same world from the same seed', () => {
    // A copy of the content is a fresh cache key, so the world is made again from scratch.
    const again = makeRegion(MAP_SEEDS[1], { ...content });
    expect(again).toEqual(regions[1]);
  });

  it('settles the valley a seed names, with its climate and ledger lines', () => {
    expect(siteOf('tallow/2')).toEqual({ region: 'tallow', site: 2 });
    expect(siteOf('tallow')).toBeUndefined();
    const valley = makeRegion('tallow', content).valleys[1]!;
    const sim = createSim(content);
    const world = createWorld(sim, 'tallow/2');
    expect(world.map.climate).toBe(valley.climate);
    const settled = world.log.find((e) => e.type === 'region.settled')!;
    expect(renderEvent(settled, sim.templates)).toContain(valley.name);
    // World-generation lines cite only the world's beginning, so they offer no "why?".
    for (const type of ['region.named', 'region.settled'])
      expect(world.log.find((e) => e.type === type)!.causes).toEqual([world.begunEvent]);
    // A plain seed has no region and writes no region lines.
    expect(createWorld(sim, 'tallow').log.some((e) => e.type.startsWith('region.'))).toBe(false);
  });
});
