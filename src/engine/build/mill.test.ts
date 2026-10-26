// 5B Bundle 4 done-whens (engine, V-133, V-150): with no order to anyone, a quern is set by a
// hearth once grain is in, the colony sites a mill on running water when the quern is busy, the
// mill grinds while its water runs and stands while it is frozen (grinding goes back to the quern),
// an oven follows, and the last field of the year brings one harvest-home supper in the hall.
import { beforeAll, describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { WATER, type WorldState } from '../core/index.ts';
import { allLines, createSim, createWorld, step, submitCommand } from '../index.ts';
import { memoriesOf } from '../needs/index.ts';
import { furnitureOf, hallOf, millOf, roomsOf, turning } from './index.ts';
import { millsOf } from './mill.ts';

const sim = createSim(content);
const DAY = 1440;
const lines = (w: WorldState, type: string) => allLines(w).filter((e) => e.type === type);
// Whether the hall's room stood when the harvest-home supper was called, read hour by hour, and
// the world as it was the hour the mill was sited (the send-back lever needs nothing built yet).
let hallAtFeast: boolean | undefined;
let atMill: WorldState | undefined;
const hallRoom = (w: WorldState) =>
  roomsOf(w, content).some((r) => r.h.id === hallOf(w)?.id && r.room?.tiles.length);
// Reads the hour's own lines, not the whole ledger, and the hall's rooms only in the feast's hour
// (each hour's full reads made this file the slowest in the suite).
const seen = new Set<string>();
const until = (w: WorldState, done: () => boolean, days: number) => {
  while (!done() && w.tick < days * DAY) {
    const hour = step(w, sim, 60);
    for (const e of hour) seen.add(e.type);
    if (hallAtFeast === undefined && hour.some((e) => e.type === 'hall.feast'))
      hallAtFeast = hallRoom(w);
    if (!atMill && millOf(w)) atMill = structuredClone(w);
  }
};

describe('the mill and harvest home', () => {
  let world: WorldState;
  beforeAll(() => {
    world = createWorld(sim, 'anvil');
    // The supper can come before the mill: its shared memory is checked before it fades.
    until(world, () => !!millOf(world) || seen.has('hall.feast'), 220);
  }, 60000);

  it("holds one harvest home when the year's last field is in, and everyone comes", () => {
    until(world, () => seen.has('hall.feast'), 220);
    const feasts = lines(world, 'hall.feast');
    expect(feasts).toHaveLength(1);
    // The barley came in first and brought no feast; the year's last field did.
    const homes = lines(world, 'farm.harvestHome');
    expect(homes.length).toBeGreaterThan(1);
    expect(feasts[0]!.causes).toContain(homes.at(-1)!.id);
    // In the hall once its room stands (strangers bring it, V-121); before that, round the fire.
    expect(feasts[0]!.data['where']).toBe(
      hallAtFeast ? 'in the hall' : 'round the fire on the green',
    );
    const alive = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
    expect(feasts[0]!.actors).toHaveLength(alive.length);
    for (const id of feasts[0]!.actors ?? [])
      expect(memoriesOf(world, id).some((m) => m['line'] === feasts[0]!.id)).toBe(true);
  }, 60000);

  it('grinds at a quern set by a hearth, then sites a mill on running water, unordered', () => {
    until(world, () => !!millOf(world), 220);
    expect(world.commandLog).toHaveLength(0);
    const quern = furnitureOf(world).find((f) => f['kind'] === content.buildings.mill.quern.kind);
    expect(quern?.['state']).toBe('built');
    expect(lines(world, 'food.ground').some((e) => e.data['where'] === 'at the quern')).toBe(true);
    const mill = millOf(world)!;
    const needed = allLines(world).find((e) => e.id === mill['line'])!;
    expect(needed.type).toBe('build.millNeeded');
    expect(String(needed.data['why'])).toMatch(/grinding at the quern took .* hours a day/);
    // Its wheel is in a stream or the river, just outside the middle of one side.
    const map = world.map;
    const wheel = mill['wheel'] as number;
    expect(['stream', 'river']).toContain(WATER[map.water[wheel]!]);
    const [wx, wy] = [wheel % map.width, Math.floor(wheel / map.width)];
    const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((k) => mill[k] as number) as number[];
    const touches =
      ((wx === x! - 1 || wx === x! + w!) && wy >= y! && wy < y! + h!) ||
      ((wy === y! - 1 || wy === y! + h!) && wx >= x! && wx < x! + w!);
    expect(touches).toBe(true);
  }, 60000);

  it('lets the mill be sent back once, and chooses another site at once', () => {
    until(world, () => !!millOf(world), 220);
    const w = atMill!;
    const first = millOf(w)!;
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { mill: first.id } });
    step(w, sim, 2);
    expect(first['state']).toBe('sent');
    const second = millOf(w)!;
    expect(second.id).not.toBe(first.id);
    expect(second['sent']).toBe(1);
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { mill: second.id } });
    step(w, sim, 2);
    expect(millOf(w)!.id).toBe(second.id);
    expect(lines(w, 'command.refused').at(-1)!.data['reason']).toMatch(/sent back once/);
  });

  it('grinds at the mill once built, then plans an oven beside it', () => {
    until(world, () => millOf(world)?.['state'] === 'built', 260);
    expect(millOf(world)!['state']).toBe('built');
    until(world, () => seen.has('build.ovenPlanned'), 280);
    expect(lines(world, 'food.ground').some((e) => e.data['where'] === 'at the mill')).toBe(true);
    expect(lines(world, 'food.baked').length).toBeGreaterThan(0);
    expect(lines(world, 'build.ovenPlanned')).toHaveLength(1);
    expect(lines(world, 'hall.feast')).toHaveLength(1);
  }, 90000);

  it('stands while its water is frozen, and grinding goes back to the quern', () => {
    const mill = millOf(world)!;
    const wheel = mill['wheel'] as number;
    // A long hard frost on the wheel's water (V-150): frozen, with the most cold it can hold.
    world.map.ice[wheel] = 0x80 | content.seasons.ice.cap;
    step(world, sim, 60);
    expect(turning(world, mill)).toBe(false);
    const stood = lines(world, 'mill.stood').at(-1)!;
    expect(stood).toBeDefined();
    const before = lines(world, 'food.ground').length;
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'setStock',
      data: { good: 'flour', level: 'plenty' },
    });
    // Milling first for everyone (a Work sheet lever), so the day's grinding does not hang on
    // whether hauling or smelting happens to fill it (it did once the cart brought wool, PR #93).
    for (const p of (world.entities['person'] ?? []).filter((q) => q['status'] === 'alive'))
      submitCommand(world, {
        tick: world.tick + 1,
        kind: 'setPriority',
        data: { person: p.id, job: content.buildings.mill.job, level: 1 },
      });
    step(world, sim, DAY);
    const after = lines(world, 'food.ground').slice(before);
    if (!turning(world, mill))
      expect(after.every((e) => e.data['where'] !== 'at the mill')).toBe(true);
    expect(after.some((e) => e.data['where'] === 'at the quern')).toBe(true);
    expect(millsOf(world).filter((m) => m['state'] !== 'sent')).toHaveLength(1);
  }, 30000);
});
