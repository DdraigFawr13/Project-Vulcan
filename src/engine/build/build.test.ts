// P3.1 and P3.2: a wall planned in test mode is built from quarried, hauled stone with no order
// to anyone, and taking it down gives the stone back; a stair built on the surface reaches
// level 1; and every lever is either an indirect lever or a test-mode tool (V-041).
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { withoutAccidents } from '../index.ts';
import { freeTile, itemsOf } from '../goods/index.ts';
import {
  createSim,
  createWorld,
  layerOf,
  step,
  submitCommand,
  SYSTEMS,
  whyOf,
  type WorldState,
  TEST_TOOLS,
} from '../index.ts';
import { canReach, walkAt } from '../paths/index.ts';
import { planAt, plansOf } from './index.ts';

// Accidents (P5.6) are left out: this tests building, not injury (health.test.ts does).
const content = withoutAccidents(game);

const sim = createSim(content);
const DAY = 1440;

/** Free open tiles with nothing growing on them, nearest the start first, in a block `n` wide
 * and `rows` deep (row by row). */
function rowOfFree(world: WorldState, n: number, rows = 1): { x: number; y: number }[] {
  const { width, startX, startY } = world.map;
  const bare = (x: number, y: number) =>
    freeTile(world, content, x, y) &&
    !world.map.features[y * width + x] &&
    content.terrain.kinds[world.map.tiles[y * width + x]!]!.buildable;
  for (let r = 3; r <= 12; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        const [x, y] = [startX + dx, startY + dy];
        const tiles = Array.from({ length: n * rows }, (_, k) => ({
          x: x + (k % n),
          y: y + Math.floor(k / n),
        }));
        if (tiles.every((t) => bare(t.x, t.y))) return tiles;
      }
  throw new Error('no free row near the start');
}

const place = (world: WorldState, part: string, tiles: { x: number; y: number }[]) =>
  tiles.forEach((t, k) =>
    submitCommand(world, { tick: world.tick + 1 + k, kind: 'placeBuilding', data: { part, ...t } }),
  );

describe('building', () => {
  it('builds a planned stone wall from quarried stone, unordered, and takes it down', () => {
    const world = createWorld(sim, 'ledger');
    const wall = rowOfFree(world, 3);
    place(world, 'wall-stone', wall);
    step(world, sim, 10);
    // The plan raised the colony's stone from none to some.
    expect(world.log.some((e) => e.type === 'goods.stockRaised')).toBe(true);
    step(world, sim, 4 * DAY);
    expect(world.commandLog.map((c) => c.kind)).toEqual(wall.map(() => 'placeBuilding'));
    const index = content.buildings.parts.findIndex((p) => p.id === 'wall-stone') + 1;
    for (const t of wall) {
      expect(world.map.built[t.y * world.map.width + t.x]).toBe(index);
      expect(walkAt(content, world.map, 0, t.y * world.map.width + t.x)).toBe(0);
    }
    // Each wall traces back through the builder taking it up to the plan and the order.
    // (The colony's own house is built too; find a line for this wall.)
    const built = world.log.find(
      (e) =>
        e.type === 'build.built' && wall.some((t) => t.x === e.data['x'] && t.y === e.data['y']),
    )!;
    const chain = whyOf(world, built.id).map((c) => c.event.type);
    expect(chain.slice(0, 3)).toEqual(['work.tookUpBuilding', 'build.planned', 'command.applied']);
    // The stone was broken from boulders by someone who took up quarrying.
    expect(world.log.some((e) => e.type === 'work.felled' && e.data['verb'] === 'broke up')).toBe(
      true,
    );

    // The stone comes back where the wall stood, citing the take-down line (the colony's stock
    // also moves in the meantime, e.g. a hearth being built, so the stock is not compared).
    submitCommand(world, { tick: world.tick + 1, kind: 'deconstruct', data: wall[0]! });
    for (let m = 0; m < DAY && !world.log.some((e) => e.type === 'build.takenDown'); m += 1)
      step(world, sim, 1);
    const down = world.log.find((e) => e.type === 'build.takenDown')!;
    expect(planAt(world, wall[0]!.x, wall[0]!.y)).toBeUndefined();
    expect(world.map.built[wall[0]!.y * world.map.width + wall[0]!.x]).toBe(0);
    const back = itemsOf(world)
      .filter((i) => i['kind'] === 'stone' && i['made'] === down.id)
      .reduce((n, i) => n + (i['count'] as number), 0);
    expect(back).toBeGreaterThanOrEqual(5);
  });

  it('refuses a plan on water, on a tree or twice on one tile', () => {
    const world = createWorld(sim, 'ledger');
    const map = world.map;
    const water = map.tiles.findIndex((t) => content.terrain.kinds[t]!.water);
    const tree = [...map.features].findIndex((f) => f && content.features[f - 1]!.kind === 'tree');
    const [free] = rowOfFree(world, 1);
    const orders = [
      { x: water % map.width, y: Math.floor(water / map.width) },
      { x: tree % map.width, y: Math.floor(tree / map.width) },
      free!,
      free!,
    ];
    place(world, 'floor-wood', orders);
    step(world, sim, 10);
    const refused = world.log.filter((e) => e.type === 'command.refused');
    expect(refused.map((e) => e.data['reason'])).toEqual([
      'the ground there cannot be built on',
      `a ${content.features[map.features[tree]! - 1]!.name} is there`,
      'something is built or planned there',
    ]);
    expect(plansOf(world)).toHaveLength(1);
  });

  it('leaves the last wall of a ring round the store unbuilt, and says why', () => {
    const world = createWorld(sim, 'ledger');
    const block = rowOfFree(world, 3, 3);
    const [inside] = block.splice(4, 1);
    submitCommand(world, { tick: world.tick + 1, kind: 'markStore', data: inside! });
    place(world, 'wall-stone', block);
    step(world, sim, 5 * DAY);
    const index = content.buildings.parts.findIndex((p) => p.id === 'wall-stone') + 1;
    const built = block.filter((t) => world.map.built[t.y * world.map.width + t.x] === index);
    expect(built).toHaveLength(7);
    const shut = world.log.filter((e) => e.type === 'build.shutIn');
    expect(shut).toHaveLength(1);
    expect(whyOf(world, shut[0]!.id)[0]!.event.type).toBe('build.planned');
    const start = { x: world.map.startX, y: world.map.startY, z: 0 };
    expect(canReach(content, world.map, start, { ...inside!, z: 0 })).toBe(true);
  });

  it('builds a wooden stair down that reaches level 1', () => {
    const world = createWorld(sim, 'ledger');
    const [at] = rowOfFree(world, 1);
    place(world, 'stair-wood', [at!]);
    step(world, sim, 2 * DAY);
    expect(layerOf(world.map, 1)).toBeDefined();
    const cut = world.log.find((e) => e.type === 'map.stairsCut')!;
    expect(whyOf(world, cut.id)[0]!.event.type).toBe('build.built');
  });

  it('has only indirect levers and test-mode tools (V-041)', () => {
    const levers = ['setStock', 'setPriority', 'setBuild', 'sendBack', 'sendBackShaft', 'setLaw'];
    const testTools = TEST_TOOLS;
    const kinds = SYSTEMS.flatMap((s) => Object.keys(s.commands ?? {}));
    expect(kinds.filter((k) => !levers.includes(k) && !testTools.includes(k))).toEqual([]);
  });
});
