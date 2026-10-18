// P2.3: ways keep to open ground and cut no corners, lead up and down stairs and shafts, refuse a
// goal nobody can reach without searching, and come out the same on a reloaded map.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, step, submitCommand } from '../index.ts';
import { canReach, findPath, pack, stepCost, unpack, walkAt, type Spot } from './index.ts';

describe('paths', () => {
  const sim = createSim(content);
  const world = createWorld(sim, 'ledger');
  const { map } = world;
  const W = map.width;
  const start: Spot = { x: map.startX, y: map.startY, z: 0 };
  const open = (i: number): boolean => walkAt(content, map, 0, i) > 0;

  it('keeps to open ground, step by step, to the far side of the camp’s ground', () => {
    // The farthest open tile joined to the camp, by straight-line steps.
    let far = -1;
    let best = -1;
    for (let i = 0; i < W * map.height; i += 1) {
      if (!open(i) || !canReach(content, map, start, unpack(map, i))) continue;
      const d = Math.max(Math.abs((i % W) - start.x), Math.abs(Math.floor(i / W) - start.y));
      if (d > best) [far, best] = [i, d];
    }
    expect(best).toBeGreaterThan(40);
    const path = findPath(content, map, start, unpack(map, far))!;
    expect(path.at(-1)).toBe(far);
    let at = pack(map, start);
    for (const node of path) {
      expect(stepCost(content, map, at, node), `step to ${node}`).toBeGreaterThan(0);
      at = node;
    }
    expect(findPath(content, map, start, start)).toEqual([]);
  });

  it('refuses rock, deep water and walled-off ground without a search', () => {
    const kinds = content.terrain.kinds;
    const rock = map.tiles.findIndex((k) => kinds[k]!.stone);
    expect(findPath(content, map, start, unpack(map, rock))).toBeUndefined();
    // Open ground the camp cannot reach (an island, a sealed hollow), if the seed has any.
    const cut = map.tiles.findIndex(
      (_, i) => open(i) && !canReach(content, map, start, unpack(map, i)),
    );
    if (cut >= 0) expect(findPath(content, map, start, unpack(map, cut))).toBeUndefined();
  });

  it('leads down stairs and a shaft to the levels below', () => {
    const w = createWorld(sim, 'ledger');
    // Stairs one tile east of the camp, and a shaft from there to level 2 beside the landing.
    const east = { x: w.map.startX + 1, y: w.map.startY };
    submitCommand(w, { tick: w.tick + 1, kind: 'cutStairs', data: { ...east, z: 0 } });
    step(w, sim, 1);
    submitCommand(w, { tick: w.tick + 1, kind: 'sinkShaft', data: { ...east, z: 1, to: 2 } });
    step(w, sim, 1);
    const from: Spot = { x: w.map.startX, y: w.map.startY, z: 0 };
    const down = findPath(content, w.map, from, { ...east, z: 2 })!;
    expect(down.map((n) => unpack(w.map, n).z)).toEqual([0, 1, 2]);
    const back = findPath(content, w.map, { ...east, z: 2 }, from)!;
    expect(back.map((n) => unpack(w.map, n).z)).toEqual([1, 0, 0]);
  });

  it('finds the same way on a reloaded map as on the running one', () => {
    const goal = unpack(
      map,
      map.tiles.findLastIndex((_, i) => open(i) && canReach(content, map, start, unpack(map, i))),
    );
    findPath(content, map, start, goal);
    // Change the ground the running map has already worked out: a tree falls (its feature goes).
    const tree = map.features.findIndex(
      (f, i) => f > 0 && content.features[f - 1]!.blocks === true && open(i - 1),
    );
    map.features[tree] = 0;
    map.chunkVersions[
      Math.floor(tree / W / 16) * Math.ceil(W / 16) + Math.floor((tree % W) / 16)
    ]! += 1;
    const running = findPath(content, map, start, goal);
    const loaded = structuredClone(map);
    expect(findPath(content, loaded, start, goal)).toEqual(running);
  });
});
