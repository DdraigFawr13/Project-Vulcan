// P3.7, P3.3, P3.8 done-when: with no order to anyone, the colony sites a house of its own choosing
// near the green, with a reason, the same on the same seed; a cottage first, then a room added as
// it fills, the growth citing the house built; everyone moves in once and stays; a room is worked
// out from its walls; the Build sheet's levers are a level and one send-back.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, needOf, step, submitCommand, whyOf } from '../index.ts';
import { itemsAt, layItem } from '../goods/index.ts';
import { freeTile } from '../goods/store.ts';
import { homeless, housesOf, plansOf, rectOf, roomAt } from './index.ts';
import { inRect } from './site.ts';

const sim = createSim(content);
const DAY = 1440;
// An open valley and a forest one (its site needs clearing).
// (tallow/3 now sites a second house instead of a room: the campfire's stone leaves the stock
// short when the first house is done.) smoke/1 for tallow/2 on the 250-tile valley (V-202):
// tallow/2's band was not all in by day 10 (searched 14 seeds 2026-11-22: ledger/1, smoke/1,
// smoke/2, anvil/1, anvil/2 and gwerin/1 hold).
const SEEDS = ['ledger/1', 'smoke/1'];
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const firstHouse = (w: World) => housesOf(w).find((h) => !h['of'])!;

// A seed's first ten days, run once and shared by the read-only tests below (they must not step
// or change it). `early` is what day 1 showed: the log is sealed by day 10, so the cottage's
// reason is read then.
// `day3` is a copy of the world on day 3, for the tests that read or carry on from there.
const tenDays = new Map<
  string,
  {
    world: World;
    day3: World;
    early: { size: unknown; chain: string[]; why: unknown; orders: number };
  }
>();
function ranWith(seed: string) {
  let r = tenDays.get(seed);
  if (!r) {
    const world = createWorld(sim, seed);
    step(world, sim, DAY);
    const sited = lines(world, 'build.sited')[0]!;
    const early = {
      size: sited.data['size'],
      chain: whyOf(world, sited.id).map((c) => c.event.type),
      why: firstHouse(world)['why'],
      orders: world.commandLog.length,
    };
    step(world, sim, 2 * DAY);
    const day3 = structuredClone(world);
    step(world, sim, 7 * DAY);
    r = { world, day3, early };
    tenDays.set(seed, r);
  }
  return r;
}
const ran = (seed: string): World => ranWith(seed).world;

describe('houses', () => {
  it('adds a room of their own for a crowded sleeper, who moves in and stops feeling crowded', () => {
    // Whether anyone feels crowded is the seed's layout (phase review, V-078): search a list.
    let world: World | undefined;
    for (const seed of ['ledger/1', 'tallow/2', 'smoke/1', 'anvil/2', 'gwerin/1']) {
      const w = ran(seed);
      if (lines(w, 'build.growsPrivate').length) {
        world = w;
        break;
      }
    }
    expect(world).toBeDefined();
    const own = lines(world!, 'build.growsPrivate')[0]!;
    expect(whyOf(world!, own.id).map((c) => c.event.type)).toContain('need.low');
    const moved = lines(world!, 'people.movedRoom').find((e) => e.actors[0] === own.actors[0]);
    expect(moved).toBeDefined();
    expect(needOf(world!, own.actors[0]!, 'privacy')!['low']).toBe(0);
  });

  it('says once why a crowded house gets no room when no side has clear ground, water and the store being in the way', () => {
    // Whether a house is boxed in is the seed's layout: search a list (5B Bundle 2 moved anvil's;
    // smoke/1 first since the 5B review, the one that boxes in today, as each miss costs 3 s).
    let blocked: ReturnType<typeof lines> = [];
    for (const seed of ['smoke/1', 'anvil', 'anvil/1', 'tallow/2']) {
      const w = createWorld(sim, seed);
      step(w, sim, 16 * DAY);
      blocked = lines(w, 'build.growBlocked');
      if (blocked.length) break;
    }
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.length).toBeLessThanOrEqual(2);
    expect(blocked[0]!.causes.length).toBeGreaterThan(0);
  });

  it('carries goods lying where a room goes aside, then builds the room there', () => {
    // Just as the cottage's last part stands, before it is counted built and grows a room.
    const done = (w: World) => {
      const h = housesOf(w).find((o) => !o['of']);
      const mine = plansOf(w).filter((p) => p['house'] === h?.id);
      return !!mine.length && mine.every((p) => p['state'] === 'built');
    };
    // Tick by tick from day 3 of the shared run if the cottage is not finished by then.
    // smoke/1 since the 250-tile valley (V-202): ledger/1's room was blocked by a bedroll
    // (searched 14 seeds 2026-11-22: tallow/2, ledger/3, smoke/1 and kiln/1 hold).
    const { day3 } = ranWith('smoke/1');
    const world = done(day3) ? createWorld(sim, 'smoke/1') : structuredClone(day3);
    while (!done(world) && world.tick < 9 * DAY) step(world, sim, 1);
    const house = firstHouse(world);
    expect(done(world)).toBe(true);
    // Felled logs lie on every tile round the house, as on a cleared forest site.
    const [x0, y0] = [house['x'] as number, house['y'] as number];
    for (let y = y0 - 6; y < y0 + (house['h'] as number) + 6; y += 1)
      for (let x = x0 - 6; x < x0 + (house['w'] as number) + 6; x += 1)
        if (
          !itemsAt(world, x, y, 0).length &&
          !inRect(rectOf(house), x, y) &&
          freeTile(world, content, x, y)
        )
          layItem(world, { kind: 'logs', count: 1, x, y, z: 0, made: house['line'] as number });
    step(world, sim, 4 * DAY);
    expect(lines(world, 'build.growBlocked')).toHaveLength(0);
    const room = housesOf(world).find((h) => h['of'] === house.id)!;
    expect(room).toBeDefined();
    const aside = lines(world, 'build.goodsAside').find((e) =>
      e.causes.includes(room['line'] as number),
    )!;
    expect(aside.data['where']).toBe("the cottage's new room");
    // The part waits for its tile to clear, then stands: the room is built with no goods in it.
    expect(room['state']).toBe('built');
    const r = rectOf(room);
    for (let y = r.y; y < r.y + r.h; y += 1)
      for (let x = r.x; x < r.x + r.w; x += 1) expect(itemsAt(world, x, y, 0)).toHaveLength(0);
  });

  for (const seed of SEEDS) {
    it(`sites a cottage with a reason, unordered, and adds a room as it fills on ${seed}`, () => {
      const { world, early } = ranWith(seed);
      expect(early.orders).toBe(0);
      expect(world.commandLog).toHaveLength(0);
      expect(early.size).toBe('cottage');
      // It traces back to the band sleeping in the open.
      expect(early.chain).toContain('build.needed');
      const house = firstHouse(world);
      expect(early.why).not.toBe('');
      expect(house['state']).toBe('built');
      // Five people, a cottage for four: a room is added on, citing the house built.
      const grows = lines(world, 'build.grows')[0]!;
      expect(grows.causes).toContain(house['built']);
      expect(lines(world, 'build.grows')).toHaveLength(1);
      expect(lines(world, 'build.sited')).toHaveLength(1);
      // Each moves in once and stays: nobody carries their bedroll back and forth.
      expect(homeless(world, content)).toEqual([]);
      expect(lines(world, 'people.movedIn')).toHaveLength(5);
    });
  }

  it('works out a room from its walls and door', () => {
    const world = structuredClone(ranWith('ledger/1').day3);
    const h = firstHouse(world);
    const [x, y] = [h['x'] as number, h['y'] as number];
    // Outside the house and on its wall there is no room; inside, the cottage's 4 by 2 floor.
    expect(roomAt(world, content, x, y)).toBeUndefined();
    expect(roomAt(world, content, x - 1, y - 1)).toBeUndefined();
    const room = roomAt(world, content, x + 1, y + 1)!;
    expect(room.tiles).toHaveLength(((h['w'] as number) - 2) * ((h['h'] as number) - 2));
    expect(room.doors).toBe(1);
    expect(room.beds).toBeGreaterThan(0);
    expect(room.role?.id).toBeDefined();
    expect(room.crowded).toBe(false);
    expect(room.look).not.toBe('');
  });

  // Houses start first (content `house.start`), so the lever moves them to second.
  it('sets the Build level, and sends a plan back once', () => {
    const world = createWorld(sim, 'tallow/3');
    // Sent back as soon as it is sited: once building has begun a plan stays (refused).
    while (!housesOf(world).length && world.tick < DAY) step(world, sim, 10);
    const first = firstHouse(world);
    expect(first['state']).toBe('plan');
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'setBuild',
      data: { kind: 'house', level: 2 },
    });
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'setBuild',
      data: { kind: 'well', level: 1 },
    });
    submitCommand(world, { tick: world.tick + 2, kind: 'sendBack', data: { house: first.id } });
    step(world, sim, 60);
    expect(lines(world, 'build.wantSet')[0]?.data['word']).toBe('second');
    expect(lines(world, 'command.refused')[0]?.data['kind']).toBe('setBuild');
    expect(first['state']).toBe('sent');
    expect(lines(world, 'build.sentBack')).toHaveLength(1);
    // The colony chooses again at once, somewhere else, and that plan cannot be sent back.
    const again = housesOf(world).find((h) => !h['of'] && h['state'] === 'plan')!;
    expect([again['x'], again['y']]).not.toEqual([first['x'], first['y']]);
    expect(lines(world, 'build.sited')).toHaveLength(2);
    submitCommand(world, { tick: world.tick + 1, kind: 'sendBack', data: { house: again.id } });
    step(world, sim, 60);
    expect(lines(world, 'command.refused').at(-1)?.data['reason']).toBe(
      'it was sent back once already',
    );
  });
});
