// V-096 as amended (Morgan, 2026-10-19): a house's walls are of the most plentiful material (stock
// plus what is within reach) among those with enough to finish the whole house of the chosen
// size; ties keep content order; the siting line says why. Where stone falls short the first
// house is timber, and where wood does, stone.
import { describe, expect, it } from 'vitest';
import { content as base, type Content } from '../../content/index.ts';
import { allLines, createSim, createWorld, step } from '../index.ts';
import { greenOf, partOf, plansOf } from './index.ts';
import { chooseHouse, costOf, partsOf, withinReach } from './site.ts';

const SEEDS = ['ledger/1', 'tallow/2'];

/** The content with one wall part costing `cost` (more than any valley holds, to make it short). */
const scarce = (wall: string, cost: number): Content => ({
  ...base,
  buildings: {
    ...base.buildings,
    parts: base.buildings.parts.map((p) => (p.id === wall ? { ...p, cost } : p)),
  },
});

/** For a fresh world: the walls that can finish the chosen house, and what the colony picks. */
function options(content: Content, seed: string) {
  const world = createWorld(createSim(content), seed);
  const pick = chooseHouse(world, content, greenOf(world), 5)!;
  const walls = content.buildings.house.walls.map((id) => partOf(content, id)!);
  const fits = walls.filter((w) =>
    [...costOf(partsOf(content, pick.site, pick.site.door, w))].every(
      ([good, n]) => withinReach(world, content, good, true) >= n,
    ),
  );
  const have = (w: (typeof walls)[number]) => withinReach(world, content, w.material, true);
  return { pick, fits, have };
}

describe('house walls', () => {
  it('are the most plentiful material that can finish the house, ties in content order', () => {
    for (const seed of SEEDS) {
      const { pick, fits, have } = options(base, seed);
      expect(fits.length).toBeGreaterThan(0);
      const most = Math.max(...fits.map(have));
      expect(have(pick.wall)).toBe(most);
      expect(pick.wall).toBe(fits.find((w) => have(w) === most));
      expect(pick.why).toContain('enough to finish');
    }
  });

  it('are timber where stone falls short, stone where wood does, and the siting line says why', () => {
    for (const [wall, material, word] of [
      ['wall-stone', 'wall-wood', 'wood'],
      ['wall-wood', 'wall-stone', 'stone'],
    ] as const) {
      const content = scarce(wall, 100000);
      const sim = createSim(content);
      for (const seed of [SEEDS[1]!]) {
        const world = createWorld(sim, seed);
        step(world, sim, 600);
        const sited = allLines(world).find((e) => e.type === 'build.sited')!;
        expect(sited.data['why']).toMatch(new RegExp(`^${word} walls, as .* enough to finish it`));
        const parts = plansOf(world)
          .filter((p) => p['house'])
          .map((p) => p['part']);
        expect(parts).toContain(material);
        expect(parts).not.toContain(wall);
      }
    }
  });
});
