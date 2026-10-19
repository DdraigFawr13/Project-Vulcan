// V-096 as amended (Morgan, 2026-10-19): a house's walls are of the most plentiful material (stock
// plus what is within reach) among those with enough to finish the whole house of the chosen
// size; ties keep content order; the siting line says why. Where stone falls short the first
// house is timber, and where wood does, stone. V-097: clay, dug and known, makes wattle and
// daub (clay, then a log a tile).
import { describe, expect, it } from 'vitest';
import { content as base, type Content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  type EntityRow,
  type WorldState,
} from '../index.ts';
import { layItem } from '../goods/index.ts';
import { greenOf, nextNeed, partOf, plansOf, stillNeeded } from './index.ts';
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

/** A fresh world with `count` of a kind laid on the green. */
function stocked(content: Content, seed: string, lay: Record<string, number>): WorldState {
  const world = createWorld(createSim(content), seed);
  const green = greenOf(world);
  for (const [kind, count] of Object.entries(lay))
    layItem(world, { kind, count, x: green.x, y: green.y, z: 0, made: 0 });
  return world;
}

describe('wattle and daub walls', () => {
  it('are chosen where logs and stone fall short and clay is plentiful, with the reason', () => {
    const content = scarce('wall-wood', 100000);
    const walls = { ...content.buildings, parts: content.buildings.parts };
    const short: Content = {
      ...content,
      buildings: {
        ...walls,
        parts: walls.parts.map((p) => (p.id === 'wall-stone' ? { ...p, cost: 100000 } : p)),
      },
    };
    const world = stocked(short, SEEDS[0]!, { clay: 5000 });
    const pick = chooseHouse(world, short, greenOf(world), 5)!;
    expect(pick.wall.id).toBe('wall-daub');
    expect(pick.why).toBe(
      'wattle and daub walls, as clay is most plentiful and enough to finish it',
    );
  });

  it('stay timber with plenty of wood, whatever clay lies about', () => {
    const world = stocked(base, SEEDS[0]!, { logs: 100000, clay: 5000 });
    const pick = chooseHouse(world, base, greenOf(world), 5)!;
    expect(pick.wall.id).toBe('wall-wood');
    expect(pick.why).toContain('wood walls');
  });

  it('ask for clay, then logs, and are built only when both are in', () => {
    const plan = (have: number, also: number): EntityRow =>
      ({ id: 1, part: 'wall-daub', state: 'plan', have, also }) as unknown as EntityRow;
    expect(nextNeed(base, plan(0, 0))).toEqual({ material: 'clay', count: 3 });
    expect(stillNeeded(base, plan(0, 0))).toBe(4);
    expect(nextNeed(base, plan(2, 0))).toEqual({ material: 'clay', count: 1 });
    expect(nextNeed(base, plan(3, 0))).toEqual({ material: 'logs', count: 1 });
    expect(stillNeeded(base, plan(3, 0))).toBe(1);
    expect(nextNeed(base, plan(3, 1))).toBeUndefined();
    expect(stillNeeded(base, plan(3, 1))).toBe(0);
  });

  it('count known clay tiles on level 1 within reach', () => {
    const world = createWorld(createSim(base), SEEDS[0]!);
    const before = withinReach(world, base, 'clay', true);
    expect(before).toBe(0);
    const { startX: x, startY: y } = world.map;
    submitCommand(world, { tick: world.tick + 1, kind: 'cutStairs', data: { x, y, z: 0 } });
    step(world, createSim(base), 1);
    const level = world.map.levels[0]!;
    const clay = base.terrain.kinds.findIndex((k) => k.id === 'clay');
    level.tiles[(y + 1) * world.map.width + x] = clay;
    expect(withinReach(world, base, 'clay', true)).toBe(0);
    level.known[(y + 1) * world.map.width + x] = 1;
    expect(withinReach(world, base, 'clay', true)).toBe(10);
  });
});
