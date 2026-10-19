// P3.7, P3.3, P3.8 done-when: with no order to anyone, the colony sites a house of its own choosing
// near the green, with a reason, the same on the same seed; a cottage first, then a room added as
// it fills, the growth citing the house built; everyone moves in once and stays; a room is worked
// out from its walls; the Build sheet's levers are a level and one send-back.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, needOf, step, submitCommand, whyOf } from '../index.ts';
import { homeless, housesOf, roomAt } from './index.ts';

const sim = createSim(content);
const DAY = 1440;
// An open valley and a forest one (its site needs clearing).
// (tallow/3 now sites a second house instead of a room: the campfire's stone leaves the stock
// short when the first house is done.)
const SEEDS = ['ledger/1', 'tallow/2'];
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const firstHouse = (w: World) => housesOf(w).find((h) => !h['of'])!;

describe('houses', () => {
  it('adds a room of their own for a crowded sleeper, who moves in and stops feeling crowded', () => {
    // Whether anyone feels crowded is the seed's layout (phase review, V-078): search a list.
    let world: World | undefined;
    for (const seed of ['ledger/1', 'tallow/2', 'smoke/1', 'anvil/2', 'gwerin/1']) {
      const w = createWorld(sim, seed);
      step(w, sim, 9 * DAY);
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

  it('says once why a crowded house gets no room when no side has clear ground (anvil)', () => {
    const w = createWorld(sim, 'anvil');
    step(w, sim, 12 * DAY);
    const blocked = lines(w, 'build.growBlocked');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.length).toBeLessThanOrEqual(2);
    expect(blocked[0]!.causes.length).toBeGreaterThan(0);
  });

  for (const seed of SEEDS) {
    it(`sites a cottage with a reason, unordered, and adds a room as it fills on ${seed}`, () => {
      const world = createWorld(sim, seed);
      step(world, sim, DAY);
      expect(world.commandLog).toHaveLength(0);
      const sited = lines(world, 'build.sited')[0]!;
      expect(sited.data['size']).toBe('cottage');
      // It traces back to the band sleeping in the open.
      expect(whyOf(world, sited.id).map((c) => c.event.type)).toContain('build.needed');
      const house = firstHouse(world);
      expect(house['why']).not.toBe('');

      step(world, sim, 9 * DAY);
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

  it('sites the same house on the same seed', () => {
    const [a, b] = [createWorld(sim, 'anvil/2'), createWorld(sim, 'anvil/2')];
    step(a, sim, DAY);
    step(b, sim, DAY);
    const at = (w: World) => (({ x, y, w: wd, h, door }) => ({ x, y, wd, h, door }))(firstHouse(w));
    expect(at(a)).toEqual(at(b));
  });

  it('works out a room from its walls and door', () => {
    const world = createWorld(sim, 'ledger/1');
    step(world, sim, 3 * DAY);
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
