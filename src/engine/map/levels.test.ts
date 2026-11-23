import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, step, submitCommand } from '../index.ts';
import { MAP_SEEDS } from './seeds.ts';
import { makeLevel } from './underground.ts';

// P1.3 done-when, amended by 6W Slice 3 (V-202): no ore lies within the start radius on any level
// below, so ore is found by looking for it; and a level nobody has reached is not made at all
// (save size: src/worker/save.test.ts).
describe('levels below', () => {
  const sim = createSim(content);
  const radius = content.terrain.generator.start.radius;
  const { depth } = content.terrain.generator.underground;

  it.each(MAP_SEEDS)(
    'seed %s has no ore near the start below, and seams only in faces over ore',
    (seed) => {
      const { map } = createWorld(sim, seed);
      let near = Infinity;
      let veins = 0;
      const levels = Array.from({ length: depth }, (_, z) => makeLevel(seed, content, map, z + 1));
      for (const level of levels)
        level.features.forEach((f, i) => {
          if (!f || !content.features[f - 1]!.vein) return;
          veins += 1;
          const x = i % map.width;
          const y = (i - x) / map.width;
          near = Math.min(near, Math.max(Math.abs(x - map.startX), Math.abs(y - map.startY)));
        });
      expect(veins).toBeGreaterThan(0);
      expect(near).toBeGreaterThan(radius);
      // A face shows a seam only where its vein lies within a tile below; nothing else marks it
      // (V-215, nothing on the ground).
      let seams = 0;
      map.faces.forEach((v, i) => {
        if (v < 2) return;
        seams += 1;
        const f = v - 1;
        const layer = levels[content.features[f - 1]!.vein!.level - 1]!;
        const [x, y] = [i % map.width, Math.floor(i / map.width)];
        const near = [-1, 0, 1].flatMap((dy) =>
          [-1, 0, 1].map((dx) => (y + dy) * map.width + x + dx),
        );
        expect(near.some((j) => layer.features[j] === f)).toBe(true);
      });
      expect(seams).toBeGreaterThan(0);
      expect('stains' in map).toBe(false);
    },
  );

  it('makes a level only when stairs or a shaft reach it, the same in any order', () => {
    const world = createWorld(sim, 'ledger');
    expect(world.map.levels).toEqual([null, null, null, null]);
    const { startX: x, startY: y } = world.map;
    const order = (kind: string, data: Record<string, number>) =>
      submitCommand(world, { tick: world.tick + 1, kind, data });
    order('sinkShaft', { x: x + 1, y, z: 0, to: 2 });
    step(world, sim, 1);
    expect(world.map.levels.map((l) => l !== null)).toEqual([true, true, false, false]);
    order('cutStairs', { x, y, z: 0 });
    order('cutStairs', { x, y, z: 4 }); // nothing lies below the deepest level
    step(world, sim, 1);
    const kinds = content.terrain.kinds;
    expect(kinds[world.map.tiles[y * world.map.width + x]!]!.id).toBe('stairs-down');
    expect(kinds[world.map.levels[0]!.tiles[y * world.map.width + x]!]!.id).toBe('stairs-up');
    const lines = world.log.slice(-6).map((e) => e.type);
    expect(lines).toEqual(
      expect.arrayContaining(['map.stairsCut', 'map.digRefused', 'command.applied']),
    );
    // Level 2 made second, straight from the seed, holds what the shaft found first.
    const fresh = makeLevel('ledger', content, world.map, 2);
    const reached = world.map.levels[1]!;
    const dug = (y * world.map.width + x + 1) as number;
    expect([...fresh.features].filter((_, i) => i !== dug)).toEqual(
      [...reached.features].filter((_, i) => i !== dug),
    );
  });

  it('lays out a level the same whether mountain tiles above it were dug first or not', () => {
    const kinds = content.terrain.kinds;
    const early = createWorld(sim, 'harrow');
    const late = createWorld(sim, 'harrow');
    const W = early.map.width;
    const stone = (i: number) => kinds[early.map.tiles[i]!]!.stone === true;
    // Rock tiles at a mountain's foot, where the rock below spreads out from.
    const foot = [...early.map.tiles.keys()]
      .filter((i) => stone(i) && i % W > 0 && !stone(i - 1))
      .filter((_, k) => k % 7 === 0)
      .slice(0, 30);
    // One world sinks shafts at the foot to level 1 and then reaches level 2 at the start; the
    // other reaches level 2 first.
    for (const i of foot)
      submitCommand(early, {
        tick: 1,
        kind: 'sinkShaft',
        data: { x: i % W, y: Math.floor(i / W), z: 0, to: 1 },
      });
    const start = { x: early.map.startX, y: early.map.startY, z: 0, to: 2 };
    submitCommand(early, { tick: 2, kind: 'sinkShaft', data: start });
    step(early, sim, 3);
    submitCommand(late, { tick: 1, kind: 'sinkShaft', data: start });
    step(late, sim, 2);
    expect(early.log.filter((e) => e.type === 'map.shaftSunk')).toHaveLength(foot.length + 1);
    const off = new Set([...foot, start.y * W + start.x]);
    const keep = (_: number, i: number) => !off.has(i);
    const [a, b] = [early.map.levels[1]!, late.map.levels[1]!];
    expect([...a.tiles].filter(keep)).toEqual([...b.tiles].filter(keep));
    expect([...a.features].filter(keep)).toEqual([...b.features].filter(keep));
  });

  it('a shaft makes its foot and the ground around it known on each level, and no more', () => {
    const world = createWorld(sim, 'ledger');
    const { startX: x, startY: y } = world.map;
    const W = world.map.width;
    submitCommand(world, { tick: 1, kind: 'sinkShaft', data: { x, y, z: 0, to: 3 } });
    step(world, sim, 1);
    for (const z of [1, 2, 3]) {
      const { known } = world.map.levels[z - 1]!;
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) expect(known[(y + dy) * W + x + dx]).toBe(1);
      expect(known[y * W + x + 10]).toBe(0);
    }
  });

  it('a shaft footed next to cave floor writes one line saying what it opened', () => {
    const world = createWorld(sim, 'ledger');
    const { map } = world;
    const { kinds } = content.terrain;
    const cave = kinds.findIndex((k) => k.id === content.terrain.generator.underground.caves.kind);
    const deep = makeLevel('ledger', content, map, 2).tiles;
    const W = map.width;
    const open = (i: number) => !kinds[map.tiles[i]!]!.water && map.features[i] === 0;
    const at = deep.findIndex(
      (t, i) =>
        i % W > 0 &&
        i % W < W - 1 &&
        i >= W &&
        i < deep.length - W &&
        (kinds[t]!.solid === true || kinds[t]!.stone === true) &&
        deep[i + 1] === cave &&
        open(i),
    );
    expect(at).toBeGreaterThanOrEqual(0);
    submitCommand(world, {
      tick: 1,
      kind: 'sinkShaft',
      data: { x: at % W, y: Math.floor(at / W), z: 0, to: 2 },
    });
    step(world, sim, 1);
    const opened = world.log.filter((e) => e.type === 'map.opened' && e.data['level'] === 2);
    expect(opened).toHaveLength(1);
    expect(String(opened[0]!.data['what'])).toContain('a cave');
    expect(opened[0]!.data['tiles']).toBeGreaterThan(0);
  });
});
