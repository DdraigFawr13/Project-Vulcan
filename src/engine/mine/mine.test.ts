// P4.1 mining (V-086, V-215, V-041): raising an ingot plate gets a shaft sited beside a found seam
// of the metal (planted here; finding one is land's prospect.test.ts), dug by colonists nobody
// orders, and the ore reaches the store. The one
// lever beside the plate is sending a shaft plan back, once. Shafts are sited on the done-when's three
// seeds; the ore test adds ledger, and keeps anvil, whose store once filled with a cleared site's logs.
import { describe, expect, it } from 'vitest';
import { content as game, type Content } from '../../content/index.ts';
import {
  withoutAccidents,
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  whyOf,
  type WorldState,
} from '../index.ts';
import { inStore, itemsOf, layItem } from '../goods/index.ts';
import { walkAt } from '../paths/index.ts';
import { nextDig, plantSeam, shaftsOf } from './index.ts';
import { openVein } from './site.ts';

const DAY = 1440;
// The plate is the only want here: a tool counts as worn (and asks for metal, P4.9) only at its
// last 1 per cent, far past these runs' days.
// Accidents (P5.6) are left out: this tests mining, not injury (health.test.ts does).
const base: Content = withoutAccidents({ ...game, tools: { ...game.tools, worn: 1 } });
const SEEDS = ['anvil', 'smoke', 'tallow'];
const ORE_SEEDS = ['anvil', 'smoke', 'tallow', 'ledger'];
// The runs that need a shaft sunk in their first days. Since 5B Bundle 1 tallow's sinker takes the
// shaft up on an evening and is felling a cleared site's trees the next morning.
const SINK_SEED = 'smoke';

const send = (world: WorldState, kind: string, data: Record<string, string | number>) =>
  submitCommand(world, { tick: world.tick + 1, kind, data });

const cheb = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Two seams of iron found, apart: the colony knows where to dig. */
function seams(world: WorldState, content: Content = base): void {
  plantSeam(world, content, 'iron');
  plantSeam(world, content, 'iron');
}

/** A fresh world with the iron plate set to `level`, run for `days`. */
function run(seed: string, days: number, content: Content = base, level = 'some') {
  const sim = createSim(content);
  const world = createWorld(sim, seed);
  seams(world, content);
  send(world, 'setStock', { good: 'iron-ingot', level });
  step(world, sim, days * DAY);
  return { sim, world };
}

// One sim for the runs on the base content: a sim holds no world's state, so runs can share it.
const plateSim = createSim(base);
// Each seed's world with the iron plate raised, a day on: the siting test reads it, and the ore
// and send-back tests carry a copy on, so the first day is run once a seed (refactor plan 3).
const firstDays = new Map<string, WorldState>();
function plateDay(seed: string): WorldState {
  let world = firstDays.get(seed);
  if (!world) {
    world = createWorld(plateSim, seed);
    // The whole valley known (V-205): these tests are not about known land.
    world.map.known.fill(1);
    seams(world);
    send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
    step(world, plateSim, DAY);
    firstDays.set(seed, world);
  }
  return structuredClone(world);
}

/** A world with the iron plate raised, run until someone has taken up sinking the first shaft.
 * Run once for the file; each caller gets its own copy. */
let sinking: WorldState | undefined;
function untilSinking() {
  const sim = plateSim;
  if (!sinking) {
    const world = createWorld(sim, SINK_SEED);
    seams(world);
    send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
    const sinker = () =>
      (world.entities['person'] ?? []).some((q) => q['job'] === 'mine' && q['task'] === 'sink');
    for (let m = 0; m < (8 * DAY) / 10 && !sinker(); m += 1) step(world, sim, 10);
    expect(sinker()).toBe(true);
    sinking = world;
  }
  return { sim, world: structuredClone(sinking) };
}

const linesOf = (world: WorldState, type: string) => allLines(world).filter((l) => l.type === type);
const oreStacks = (world: WorldState) =>
  itemsOf(world).filter(
    (i) =>
      i['kind'] === 'iron-ore' &&
      inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
  );

describe('mining', () => {
  it('sites one shaft beside the nearer found seam, on dry ground, with the reason', () => {
    for (const seed of SEEDS) {
      const world = plateDay(seed);
      const shafts = shaftsOf(world);
      expect(shafts).toHaveLength(1);
      const s = shafts[0]!;
      const map = world.map;
      const i = (s['y'] as number) * map.width + (s['x'] as number);
      const seam = map.places.find((p) => p.what === 'iron')!;
      expect(cheb(s['x'] as number, s['y'] as number, seam.x, seam.y)).toBeLessThanOrEqual(
        base.work.mine.near,
      );
      expect(walkAt(base, map, 0, i)).toBe(1);
      const planned = linesOf(world, 'mine.shaftPlanned')[0]!;
      expect(planned.id).toBe(s['line']);
      expect(planned.data['why']).toMatch(
        /^Iron is wanted \(0 of 10 ingots\) and no open vein holds iron\. This is beside the rust seam found in a rock face: \d+ tiles [a-z-]+ of the green, on dry, level ground\.$/,
      );
      expect(whyOf(world, planned.id).map((c) => c.event.type)).toContain('goods.stockSet');
      expect(planned.causes).toContain(seam.line);
    }
  });

  // One test a seed: since the larder (thirst, sowing first) tallow takes 22 days to its ore, and
  // four seeds in one test ran past the time limit on CI. Since 5B Bundle 3 anvil takes 34: the
  // cooks' firewood walks site its wood yard 5 days sooner, and the yard is built before the ore.
  // Since knapping (V-195) anvil takes 37.
  it.each(ORE_SEEDS)(
    'gets iron ore to the store with only the plate raised, each line tracing to it (%s)',
    (seed) => {
      const sim = plateSim;
      // No ore is in the store on the first day (the siting test reads that day).
      const world = plateDay(seed);
      let days = 1;
      // Each taking-up line's causes, read while fresh: a line past the sealed week keeps no
      // causes, and since knapping (V-195) anvil's miner takes up 7 days before the ore is in.
      const fresh = new Map<number, string[]>();
      while (!oreStacks(world).length && days < 50) {
        step(world, sim, DAY);
        days += 1;
        for (const l of linesOf(world, 'work.tookUp'))
          if (!fresh.has(l.id))
            fresh.set(
              l.id,
              whyOf(world, l.id).map((c) => c.event.type),
            );
      }
      expect(oreStacks(world).length).toBeGreaterThan(0);
      const applied = linesOf(world, 'command.applied').map((l) => l.data['kind']);
      expect(applied).toEqual(['setStock']);
      const made = oreStacks(world)[0]!['made'] as number;
      const took = whyOf(world, made).find((c) => c.event.type === 'work.tookUp');
      expect(took).toBeDefined();
      expect(fresh.get(took!.event.id)).toContain('goods.stockSet');
      // The iron shaft, planned first, sunk three levels (a slow seed may have begun copper and
      // tin shafts by then).
      const sunk = linesOf(world, 'map.shaftSunk');
      const at = (l: (typeof sunk)[number]) => `${l.data['x']},${l.data['y']}`;
      expect(sunk.filter((l) => at(l) === at(sunk[0]!))).toHaveLength(3);
      expect(linesOf(world, 'mine.sank').length).toBeGreaterThan(0);
    },
  );

  it('sends a shaft plan back once; the replacement cannot be sent back', () => {
    const sim = plateSim;
    const world = plateDay('tallow');
    const first = shaftsOf(world)[0]!;
    send(world, 'sendBackShaft', { shaft: first.id });
    step(world, sim, 60);
    const [old, next] = shaftsOf(world);
    expect(old!['state']).toBe('sent');
    expect(next!['sentBack']).toBe(1);
    expect(next!['state']).toBe('planned');
    // Beside the other seam found.
    const other = world.map.places.filter((p) => p.what === 'iron')[1]!;
    const by = cheb(next!['x'] as number, next!['y'] as number, other.x, other.y);
    expect(by).toBeLessThanOrEqual(base.work.mine.near);
    send(world, 'sendBackShaft', { shaft: next!.id });
    step(world, sim, 60);
    const refused = linesOf(world, 'command.refused').at(-1)!;
    expect(refused.data['kind']).toBe('sendBackShaft');
    expect(String(refused.data['reason'])).toContain('cannot be sent back again');
    expect(shaftsOf(world).filter((s) => s['state'] === 'planned')).toHaveLength(1);
  });

  it('plans no shaft and says nothing while no seam of the metal is found', () => {
    const blind: Content = {
      ...base,
      work: {
        ...base.work,
        scout: { ...base.work.scout, prospect: { ...base.work.scout.prospect, per: 1e9 } },
      },
    };
    const sim = createSim(blind);
    const world = createWorld(sim, 'tallow');
    send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
    step(world, sim, 3 * DAY);
    expect(shaftsOf(world)).toHaveLength(0);
    expect(linesOf(world, 'mine.shaftPlanned')).toHaveLength(0);
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
    const world = createWorld(sim, SINK_SEED);
    seams(world);
    send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
    // Hour by hour, so the vein is gone before anyone has mined it and iron is still short.
    for (let h = 0; h < 24 * 24 && shaftsOf(world)[0]?.['state'] !== 'done'; h += 1)
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
    const other = world.map.places.filter((p) => p.what === 'iron')[1]!;
    const by = cheb(next['x'] as number, next['y'] as number, other.x, other.y);
    expect(by).toBeLessThanOrEqual(base.work.mine.near);
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
    for (let m = 0; m < (8 * DAY) / 10 && !linesOf(world, 'mine.sank').length; m += 1)
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

  it('keeps a vein dark until it is known, and plans tunnels only on what miners know', () => {
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
    // A band of rock round the shaft foot, shown, with an iron tile beside the foot, not shown.
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = 1; dx <= 8; dx += 1) {
        level.tiles[(y + dy) * map.width + x + dx] = kind('rock-wall');
        level.known[(y + dy) * map.width + x + dx] = 1;
      }
    level.features[at(1)] = iron;
    level.known[at(1)] = 0;
    const foot = { x, y, z: 3 };
    const next = () => nextDig(world, base, foot, 'iron', new Set())?.tile;
    // Unknown, it is no open vein and no tunnel makes for it (V-215).
    expect(openVein(world, base, 'iron')).toBe(false);
    expect(next()).toBeUndefined();
    // Shown, it is open beside the foot.
    level.known[at(1)] = 1;
    expect(openVein(world, base, 'iron')).toBe(true);
    // A known vein tile farther off: the way runs through known open ground first.
    level.features[at(1)] = 0;
    level.features[at(8)] = iron;
    level.known[at(8)] = 1;
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
});
