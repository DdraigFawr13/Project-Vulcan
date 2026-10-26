// 5B Bundle 1 done-whens (engine, V-129): with no order to anyone, the colony sites a store of a
// kind from the carrying it has watched, says why, builds its edge, and carries that kind's goods
// into it; the home store keeps everything else.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { depotsOf, insideDepot, itemsOf, storeKindOf } from '../goods/index.ts';
import { allLines, createSim, createWorld, greenOf, step, whyOf } from '../index.ts';
import { reachFrom, walkAt } from '../paths/index.ts';

const sim = createSim(content);
const DAY = 1440;

describe('stores by kind', () => {
  it('sites a store from need, builds it and fills it with its own goods, unordered', () => {
    const world = createWorld(sim, 'smoke');
    const built = () => depotsOf(world).find((d) => d['state'] === 'built');
    while (!built() && world.tick < 60 * DAY) step(world, sim, DAY);
    const depot = built()!;
    expect(depot).toBeDefined();
    expect(world.commandLog).toHaveLength(0);
    const kind = content.buildings.stores.kinds.find((k) => k.id === depot['store'])!;
    // The line says where and why, in the colony's own reckoning of the walking.
    const sited = allLines(world).find((e) => e.id === depot['line'])!;
    expect(sited.type).toBe('build.storeSited');
    expect(sited.data['store']).toBe(kind.name);
    expect(String(sited.data['why'])).toMatch(/tiles a day carrying|no room left/);
    // Builders put up its edge: the built line cites the siting.
    const up = allLines(world).find((e) => e.id === depot['built'])!;
    expect(up.type).toBe('build.storeBuilt');
    expect(whyOf(world, up.id).map((c) => c.event.id)).toContain(sited.id);
    // A store of food stands near the green, where food is eaten.
    if (kind.eaten) {
      const g = greenOf(world);
      const cx = (depot['x'] as number) + ((depot['w'] as number) >> 1);
      const cy = (depot['y'] as number) + ((depot['h'] as number) >> 1);
      const d = Math.max(Math.abs(cx - g.x), Math.abs(cy - g.y));
      expect(d).toBeLessThanOrEqual(content.buildings.stores.eatenNear);
    }
    // Within days its goods are carried in, and nothing of another kind is kept there.
    step(world, sim, 5 * DAY);
    const inside = itemsOf(world).filter(
      (i) => !i['holder'] && i['z'] === 0 && insideDepot(depot, i['x'] as number, i['y'] as number),
    );
    expect(inside.length).toBeGreaterThan(0);
    for (const i of inside) expect(storeKindOf(content, i['kind'] as string)?.id).toBe(kind.id);
  }, 30000);

  it('never sites a store whose edge shuts off ground beside it, such as a pasture gate', () => {
    // ledger: the wood yard once went up a tile from the pasture fence, between two boulders, and
    // its edge sealed the pasture's only gate; the flock was never folded again.
    const world = createWorld(sim, 'ledger');
    const wood = () => depotsOf(world).find((d) => d['store'] === 'wood');
    while (wood()?.['state'] !== 'built' && world.tick < 40 * DAY) step(world, sim, DAY);
    expect(wood()?.['state']).toBe('built');
    const map = world.map;
    const reach = reachFrom(content, map, greenOf(world));
    const pasture = world.entities['pasture']![0]!;
    for (const gate of [pasture['gate'], pasture['foldGate']] as number[]) {
      const [x, y] = [gate % map.width, Math.floor(gate / map.width)];
      const sides = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].filter(([sx, sy]) => walkAt(content, map, 0, sy! * map.width + sx!) > 0);
      expect(sides.length).toBeGreaterThan(0);
      for (const [sx, sy] of sides) expect(reach({ x: sx!, y: sy!, z: 0 })).toBe(true);
    }
  }, 30000);
});
