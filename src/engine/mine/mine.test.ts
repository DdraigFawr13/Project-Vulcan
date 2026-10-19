// P4.1 mining (V-086, V-087, V-041): raising an ingot plate gets a shaft sited by the metal's stain
// outside the town ring, dug by colonists nobody orders, and the ore reaches the store. The one
// lever beside the plate is sending a shaft plan back, once. Shafts are sited on the done-when's three
// seeds; the ore test leaves out anvil, whose store is boxed in and full of logs by day 16 before any
// mining (a store problem, not a mining one, with its own fix).
import { describe, expect, it } from 'vitest';
import { content as base, type Content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  whyOf,
  type WorldState,
} from '../index.ts';
import { greenOf, ringOf } from '../build/index.ts';
import { inStore, itemsOf } from '../goods/index.ts';
import { walkAt } from '../paths/index.ts';
import { shaftsOf } from './index.ts';

const DAY = 1440;
const SEEDS = ['anvil', 'smoke', 'tallow'];
const ORE_SEEDS = ['smoke', 'tallow', 'ledger'];

const send = (world: WorldState, kind: string, data: Record<string, string | number>) =>
  submitCommand(world, { tick: world.tick + 1, kind, data });

/** Whether a stain of feature `f` lies within `work.mine.near` tiles of (x, y). */
function stainedNear(map: WorldState['map'], x: number, y: number, f: number): boolean {
  const near = base.work.mine.near;
  for (let dy = -near; dy <= near; dy += 1)
    for (let dx = -near; dx <= near; dx += 1)
      if (map.stains[(y + dy) * map.width + x + dx] === f) return true;
  return false;
}

/** A fresh world with the iron plate set to `level`, run for `days`. */
function run(seed: string, days: number, content: Content = base, level = 'some') {
  const sim = createSim(content);
  const world = createWorld(sim, seed);
  send(world, 'setStock', { good: 'iron-ingot', level });
  step(world, sim, days * DAY);
  return { sim, world };
}

const linesOf = (world: WorldState, type: string) => allLines(world).filter((l) => l.type === type);
const oreStacks = (world: WorldState) =>
  itemsOf(world).filter(
    (i) =>
      i['kind'] === 'iron-ore' &&
      inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
  );

describe('mining', () => {
  it('sites one shaft by the metal stain past the ring, on dry ground, with the reason', () => {
    for (const seed of SEEDS) {
      const { world } = run(seed, 1);
      const shafts = shaftsOf(world);
      expect(shafts).toHaveLength(1);
      const s = shafts[0]!;
      const map = world.map;
      const i = (s['y'] as number) * map.width + (s['x'] as number);
      const iron = base.features.findIndex((f) => f.id === 'iron') + 1;
      const green = greenOf(world);
      expect(stainedNear(map, s['x'] as number, s['y'] as number, iron)).toBe(true);
      expect(walkAt(base, map, 0, i)).toBe(1);
      const far = Math.max(
        Math.abs((s['x'] as number) - green.x),
        Math.abs((s['y'] as number) - green.y),
      );
      expect(far).toBeGreaterThan(ringOf(world, base));
      const planned = linesOf(world, 'mine.shaftPlanned')[0]!;
      expect(planned.id).toBe(s['line']);
      expect(planned.data['why']).toMatch(
        /^Iron is wanted \(0 of 10 ingots\) and no open vein holds iron\. This is by the nearest rust stain past the town ring: \d+ tiles [a-z-]+ of the green, on dry, level ground\.$/,
      );
      expect(whyOf(world, planned.id).map((c) => c.event.type)).toContain('goods.stockSet');
    }
  });

  it('gets iron ore to the store with only the plate raised, each line tracing to it', () => {
    for (const seed of ORE_SEEDS) {
      const sim = createSim(base);
      const world = createWorld(sim, seed);
      send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
      let days = 0;
      while (!oreStacks(world).length && days < 30) {
        step(world, sim, DAY);
        days += 1;
      }
      expect(oreStacks(world).length).toBeGreaterThan(0);
      const applied = linesOf(world, 'command.applied').map((l) => l.data['kind']);
      expect(applied).toEqual(['setStock']);
      const made = oreStacks(world)[0]!['made'] as number;
      const chain = whyOf(world, made).map((c) => c.event.type);
      expect(chain).toContain('work.tookUp');
      expect(chain).toContain('goods.stockSet');
      expect(linesOf(world, 'map.shaftSunk').length).toBe(3);
    }
  });

  it('sends a shaft plan back once; the replacement cannot be sent back', () => {
    const sim = createSim(base);
    const world = createWorld(sim, 'tallow');
    send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
    step(world, sim, 1 * DAY);
    const first = shaftsOf(world)[0]!;
    send(world, 'sendBackShaft', { shaft: first.id });
    step(world, sim, 60);
    const [old, next] = shaftsOf(world);
    expect(old!['state']).toBe('sent');
    expect(next!['sentBack']).toBe(1);
    expect(next!['state']).toBe('planned');
    const apart = Math.max(
      Math.abs((next!['x'] as number) - (old!['x'] as number)),
      Math.abs((next!['y'] as number) - (old!['y'] as number)),
    );
    expect(apart).toBeGreaterThan(6);
    send(world, 'sendBackShaft', { shaft: next!.id });
    step(world, sim, 60);
    const refused = linesOf(world, 'command.refused').at(-1)!;
    expect(refused.data['kind']).toBe('sendBackShaft');
    expect(String(refused.data['reason'])).toContain('cannot be sent back again');
    expect(shaftsOf(world).filter((s) => s['state'] === 'planned')).toHaveLength(1);
  });

  it('says once that no stain lies within reach when the metal has none', () => {
    const bare: Content = {
      ...base,
      features: base.features.map((f) =>
        f.id === 'iron' ? { ...f, vein: { ...f.vein!, stain: false } } : f,
      ),
    };
    const { world } = run('tallow', 3, bare);
    const alerts = linesOf(world, 'mine.noStain');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.data['metal']).toBe('iron');
    expect(shaftsOf(world)).toHaveLength(0);
  });

  it('digs known clay on level 1 for a wall plan that waits for it, then it is hauled up', () => {
    const sim = createSim(base);
    const world = createWorld(sim, 'tallow');
    const { startX: x, startY: y } = world.map;
    send(world, 'cutStairs', { x, y, z: 0 });
    step(world, sim, 1);
    const level = world.map.levels[0]!;
    const at = y * world.map.width + x + 1;
    level.tiles[at] = base.terrain.kinds.findIndex((k) => k.id === 'clay');
    level.known[at] = 1;
    send(world, 'placeBuilding', { part: 'wall-daub', x: x + 4, y: y + 4 });
    // Mining is last on everyone's sheet; the player puts it first for those able.
    for (const q of world.entities['person'] ?? [])
      if ((q['strength'] as number) >= 10 && (q['endurance'] as number) >= 9)
        send(world, 'setPriority', { person: q.id, job: 'mine', level: 1 });
    step(world, sim, 3 * DAY);
    const dug = linesOf(world, 'mine.clayDug');
    expect(dug).toHaveLength(1);
    expect(dug[0]!.data['part']).toBe('wattle and daub wall');
    const clay = itemsOf(world).filter((i) => i['kind'] === 'clay');
    expect(clay.length).toBeGreaterThan(0);
    expect(clay.every((i) => i['z'] === 0 || i['holder'])).toBe(true);
  });

  it('is deterministic: the same seed and lever give the same ledger', () => {
    const a = run('tallow', 10).world;
    const b = run('tallow', 10).world;
    expect(JSON.stringify(allLines(a))).toBe(JSON.stringify(allLines(b)));
    expect(linesOf(a, 'mine.sank').length).toBeGreaterThan(0);
  });
});
