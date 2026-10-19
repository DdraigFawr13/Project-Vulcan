// P4.1 mining (V-086, V-087, V-041): raising an ingot plate gets a shaft sited by the metal's stain
// outside the town ring, dug by colonists nobody orders, and the ore reaches the store. The one
// lever beside the plate is sending a shaft plan back, once. Shafts are sited on the done-when's three
// seeds; the ore test adds ledger, and keeps anvil, whose store once filled with a cleared site's logs.
import { describe, expect, it } from 'vitest';
import { content as game, type Content } from '../../content/index.ts';
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
import { inStore, itemsOf, layItem } from '../goods/index.ts';
import { walkAt } from '../paths/index.ts';
import { nextDig, shaftsOf } from './index.ts';
import { openVein } from './site.ts';

const DAY = 1440;
// The plate is the only want here: a tool counts as worn (and asks for metal, P4.9) only at its
// last 1 per cent, far past these runs' days.
const base: Content = { ...game, tools: { ...game.tools, worn: 1 } };
const SEEDS = ['anvil', 'smoke', 'tallow'];
const ORE_SEEDS = ['anvil', 'smoke', 'tallow', 'ledger'];

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

/** A world with the iron plate raised, run until someone has taken up sinking the first shaft. */
function untilSinking() {
  const sim = createSim(base);
  const world = createWorld(sim, 'tallow');
  send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
  const sinker = () =>
    (world.entities['person'] ?? []).some((q) => q['job'] === 'mine' && q['task'] === 'sink');
  for (let m = 0; m < (8 * DAY) / 10 && !sinker(); m += 1) step(world, sim, 10);
  expect(sinker()).toBe(true);
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

  it('spends a sunk shaft that opens no way to a vein, says so once and sites another', () => {
    const sim = createSim(base);
    const world = createWorld(sim, 'tallow');
    send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
    // Hour by hour, so the vein is gone before anyone has mined it and iron is still short.
    for (let h = 0; h < 12 * 24 && shaftsOf(world)[0]?.['state'] !== 'done'; h += 1)
      step(world, sim, DAY / 24);
    const first = shaftsOf(world)[0]!;
    expect(first['state']).toBe('done');
    // The vein is worked out: none of it is left on its level.
    const iron = base.features.findIndex((f) => f.id === 'iron') + 1;
    const level = world.map.levels[(first['to'] as number) - 1]!;
    level.features.forEach((f, i) => f === iron && (level.features[i] = 0));
    step(world, sim, 3 * DAY);
    const alerts = linesOf(world, 'mine.noVein');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.data['metal']).toBe('iron');
    expect(whyOf(world, alerts[0]!.id).map((c) => c.event.type)).toContain('goods.stockSet');
    expect(shaftsOf(world)[0]!['state']).toBe('spent');
    const next = shaftsOf(world)[1]!;
    expect(next['state']).not.toBe('sent');
    expect(next['sentBack']).toBe(0);
    const apart = Math.max(
      Math.abs((next['x'] as number) - (first['x'] as number)),
      Math.abs((next['y'] as number) - (first['y'] as number)),
    );
    expect(apart).toBeGreaterThan(base.work.mine.avoid);
    expect(whyOf(world, next['line'] as number).map((c) => c.event.type)).toContain('mine.noVein');
    // Once for each change of the plate, however many shafts come to nothing.
    step(world, sim, 8 * DAY);
    expect(linesOf(world, 'mine.noVein')).toHaveLength(1);
  });

  it('refuses to send a shaft back once someone has taken up sinking it', () => {
    const { sim, world } = untilSinking();
    const shaft = shaftsOf(world)[0]!;
    expect([shaft['state'], shaft['depth']]).toEqual(['planned', 0]);
    send(world, 'sendBackShaft', { shaft: shaft.id });
    step(world, sim, 1);
    const refused = linesOf(world, 'command.refused').at(-1)!;
    expect(refused.data['reason']).toBe('digging has begun');
    expect(shaft['state']).not.toBe('sent');
  });

  it('sinks with a ladder of logs though the logs lie in stacks of one', () => {
    const { sim, world } = untilSinking();
    // Every stack of logs lying about is broken into single logs, before the sinker fetches any.
    for (const item of [...itemsOf(world)])
      if (item['kind'] === 'logs' && !item['holder'])
        while ((item['count'] as number) > 1) {
          item['count'] = (item['count'] as number) - 1;
          const { x, y, z, made } = item as Record<string, number>;
          layItem(world, { kind: 'logs', count: 1, x: x!, y: y!, z: z!, made: made! });
        }
    for (let m = 0; m < DAY / 10 && !linesOf(world, 'mine.sank').length; m += 1)
      step(world, sim, 10);
    expect(linesOf(world, 'mine.sank')[0]?.data['ladder']).toBe(' with 2 logs for a ladder');
  });

  it('says once that the logs for a ladder cannot be had, and waits', () => {
    const bare: Content = {
      ...base,
      work: { ...base.work, mine: { ...base.work.mine, ladder: { logs: 100000 } } },
    };
    const { world } = run('tallow', 4, bare);
    const alerts = linesOf(world, 'mine.noLadder');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.data).toEqual({ metal: 'iron', logs: 100000 });
    expect(whyOf(world, alerts[0]!.id).map((c) => c.event.type)).toContain('goods.stockSet');
    expect(linesOf(world, 'mine.sank')).toHaveLength(0);
  });

  it('sees a vein through the fog but plans its tunnel only on ground it knows', () => {
    const sim = createSim(base);
    const world = createWorld(sim, 'tallow');
    const { startX: x, startY: y } = world.map;
    send(world, 'sinkShaft', { x, y, z: 0, to: 3 });
    step(world, sim, 1);
    const map = world.map;
    const iron = base.features.findIndex((f) => f.id === 'iron') + 1;
    const level = map.levels[2]!;
    level.features.forEach((f, i) => f === iron && (level.features[i] = 0));
    const kind = (id: string) => base.terrain.kinds.findIndex((k) => k.id === id);
    const at = (dx: number) => y * map.width + x + dx;
    // A band of rock round the shaft foot, shown, with an iron tile at its end, not shown.
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = 1; dx <= 8; dx += 1) {
        level.tiles[(y + dy) * map.width + x + dx] = kind('rock-wall');
        level.known[(y + dy) * map.width + x + dx] = 1;
      }
    level.features[at(8)] = iron;
    level.known[at(8)] = 0;
    expect(openVein(world, base, 'iron')).toBe(false);
    level.tiles[at(1)] = kind('rock-wall');
    level.features[at(1)] = iron;
    level.known[at(1)] = 0;
    // A vein tile beside the foot counts as open though it was never shown.
    expect(openVein(world, base, 'iron')).toBe(true);
    level.features[at(1)] = 0;
    const foot = { x, y, z: 3 };
    const next = () => nextDig(world, base, foot, 'iron', new Set())?.tile;
    expect(next()).toBe(at(1));
    // Ground not shown costs as rock, whatever it is: a cave floor there is the next tile to dig.
    level.tiles[at(1)] = kind(base.terrain.generator.underground.caves.kind);
    level.known[at(1)] = 0;
    expect(next()).toBe(at(1));
    // Shown, it is open ground and the way goes on through it.
    level.known[at(1)] = 1;
    expect(next()).toBe(at(2));
    // Shown water no one can walk is never routed through.
    level.tiles[at(1)] = kind('rock-wall');
    level.tiles[at(2)] = kind('water-deep');
    level.known[at(2)] = 1;
    for (const dy of [-1, 1]) level.tiles[(y + dy) * map.width + x + 2] = kind('rock-wall');
    const route = nextDig(world, base, foot, 'iron', new Set());
    expect(route?.tile).not.toBe(at(2));
    expect(route).toBeDefined();
  });

  it('is deterministic: the same seed and lever give the same ledger', () => {
    const a = run('tallow', 10).world;
    const b = run('tallow', 10).world;
    expect(JSON.stringify(allLines(a))).toBe(JSON.stringify(allLines(b)));
    expect(linesOf(a, 'mine.sank').length).toBeGreaterThan(0);
  });
});
