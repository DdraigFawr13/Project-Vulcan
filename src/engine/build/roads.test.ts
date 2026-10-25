// P5.10 done-when (V-054, V-120): footfall wears the ground in stages and fades; with no order to
// anyone, the colony plans a stone road on the most worn way between two of its places, names the
// way, lays it, and a step on it is cheaper.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, step } from '../index.ts';
import { itemsAt, layItem, storeOf } from '../goods/index.ts';
import { tread, wearStage } from '../map/index.ts';
import { fadeWear } from '../map/wear.ts';
import { findPath, pack, stepCost } from '../paths/index.ts';
import { greenOf, housesOf, plansOf, roadsOf } from './index.ts';

const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

describe('worn paths and roads', () => {
  it('wears a tile in stages as people tread it, and fades it day by day', () => {
    const w = createWorld(sim, 'ledger/1');
    const map = w.map;
    const i = 10 * map.width + 10;
    const chunk = () => map.chunkVersions[0]!;
    const before = chunk();
    for (let k = 0; k < content.terrain.wear.stages[0]!; k += 1) tread(content, map, i);
    expect(map.worn[i]).toBe(1);
    expect(chunk()).toBe(before + 1);
    expect(wearStage(content, 0)).toBe(0);
    for (let d = 0; d < 400; d += 1) fadeWear(content, map);
    expect(map.wear[i]).toBe(0);
    expect(map.worn[i]).toBe(0);
  });

  it('lays a road on the worn way from the green to the cottage, named, and it walks faster', () => {
    const w = createWorld(sim, 'ledger/1');
    const map = w.map;
    // Until the first cottage stands and no other plan waits.
    const ready = () =>
      housesOf(w).some((h) => !h['of'] && h['state'] === 'built') &&
      !plansOf(w).some((p) => p['state'] === 'plan');
    while (!ready() && w.tick < 30 * DAY) step(w, sim, 60);
    expect(ready()).toBe(true);
    const cottage = housesOf(w).find((h) => !h['of'])!;
    const door = cottage['door'] as number;
    const green = greenOf(w);
    const way = findPath(content, map, green, {
      x: door % map.width,
      y: Math.floor(door / map.width),
      z: 0,
    })!;
    // Feet have worn the way, and stone lies spare in the store.
    for (const n of way) map.wear[n] = 400;
    const free = storeOf(w).find((s) => !itemsAt(w, s['x'] as number, s['y'] as number, 0).length)!;
    layItem(w, {
      kind: 'stone',
      count: 40,
      x: free['x'] as number,
      y: free['y'] as number,
      z: 0,
      made: 0,
    });
    w.systems['build']!['roadTried'] = 0;
    step(w, sim, 60);
    const road = roadsOf(w).find((r) => r['state'] === 'plan');
    expect(road).toBeDefined();
    expect([road!['from'], road!['to']]).toContain('the green');
    expect(lines(w, 'build.roadPlanned')).toHaveLength(1);
    const tiles = road!['tiles'] as number[];
    expect(tiles.length).toBeGreaterThanOrEqual(content.buildings.roads.shortest);
    while (road!['state'] !== 'built' && w.tick < 60 * DAY) step(w, sim, 60);
    expect(road!['state']).toBe('built');
    expect(lines(w, 'build.roadLaid')[0]!.causes).toContain(road!['line']);
    // A straight step onto a road tile costs `walking.road` tenths, not a plain 10.
    const [a, b] = [tiles[0]!, tiles[1]!];
    const step1 = stepCost(
      content,
      map,
      pack(map, { x: a % map.width, y: Math.floor(a / map.width), z: 0 }),
      b,
    );
    const plain = Math.abs(a - b) === 1 || Math.abs(a - b) === map.width ? 10 : 14;
    expect(step1).toBe(Math.floor((plain * content.terrain.walking.road) / 10));
  });
});
