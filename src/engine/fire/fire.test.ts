// P3.6 done-whens: in a hard winter, with no orders at all, the band builds a campfire on the green
// and lights it, and every house room with sleepers gets a lit hearth; anyone who has been in a
// heated room for two hours is above the warmth warning line. A fire out of firewood goes out with
// a line that leads back to the empty Firewood plate; every lever stays indirect (V-041).
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { withoutAccidents } from '../index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  furnitureOf,
  heatAt,
  needOf,
  removeEntity,
  roomAt,
  roomsOf,
  step,
  stockOf,
  submitCommand,
  SYSTEMS,
  whyOf,
} from '../index.ts';
import { firesOf } from './index.ts';

// Accidents (P5.6) are left out: this tests fires, not injury (health.test.ts does).
const content = withoutAccidents(game);

// Every month at -12 degrees: a winter that never lets up.
const winter = {
  ...content,
  seasons: { ...content.seasons, months: content.seasons.months.map(() => -12) },
};
const sim = createSim(winter);
const DAY = 1440;
const SEEDS = ['ledger', 'tallow', 'anvil'];
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];
const warmthLine = content.life.needs.find((n) => n.id === 'warmth')!.low;

/** Rooms of built houses with someone sleeping in them, and whether each has a lit hearth. */
function roomsLit(w: World): boolean[] {
  return roomsOf(w, winter)
    .filter((rr) => rr.room.sleepers > 0)
    .map((rr) => {
      const inside = new Set(rr.room.tiles);
      return firesOf(w).some((f) => {
        const piece = furnitureOf(w).find((p) => p.id === f['piece'])!;
        return (
          !!f['lit'] && inside.has((piece['y'] as number) * w.map.width + (piece['x'] as number))
        );
      });
    });
}

describe('hearth and firewood', () => {
  for (const seed of SEEDS) {
    it(`keeps a heated room above the warmth line through a hard winter, unordered, on ${seed}`, () => {
      const w = createWorld(sim, seed);
      let allLitDay = 0;
      // Hours in a heated room so far, per person; samples days 8 to 14 (two more days since 5B
      // Bundle 2: walking to drink costs the band about a day of its first fortnight).
      const streak = new Map<number, number>();
      let sampled = 0;
      let under = 0;
      let lowest = Infinity;
      for (let h = 0; h < 14 * 24; h += 1) {
        step(w, sim, 60);
        const day = Math.floor(w.tick / DAY);
        const lit = roomsLit(w);
        if (!allLitDay && lit.length && lit.every(Boolean)) allLitDay = day;
        for (const p of people(w)) {
          const [x, y] = [p['x'] as number, p['y'] as number];
          const heated = !!roomAt(w, winter, x, y) && heatAt(w, winter, y * w.map.width + x) > 0;
          streak.set(p.id, heated ? (streak.get(p.id) ?? 0) + 1 : 0);
          if (day < 8 || streak.get(p.id)! < 2) continue;
          const warmth = needOf(w, p.id, 'warmth')!['value'] as number;
          sampled += 1;
          lowest = Math.min(lowest, warmth);
          if (warmth < warmthLine) under += 1;
        }
      }
      expect(w.commandLog).toHaveLength(0);
      const lines = allLines(w);
      const campfire = lines.find(
        (e) => e.type === 'fire.lit' && e.data['where'] === 'on the green',
      );
      // The table for the report: first campfire lit day, all rooms lit day, samples, under, min.
      console.log(
        `${seed}: campfire lit day ${Math.floor(campfire!.tick / DAY)}, all rooms lit day ${allLitDay}, ` +
          `${sampled} samples, ${under} under the line, lowest ${lowest}`,
      );
      expect(campfire).toBeDefined();
      expect(allLitDay).toBeGreaterThan(0);
      expect(allLitDay).toBeLessThanOrEqual(14);
      expect(sampled).toBeGreaterThan(0);
      expect(under).toBe(0);
      // The fires are banked for the night and unbanked at dawn.
      expect(lines.some((e) => e.type === 'fire.banked')).toBe(true);
      expect(lines.some((e) => e.type === 'fire.unbanked')).toBe(true);
    });
  }

  it('plans no room hearth in warm weather, though the campfire is still planned', () => {
    const warm = {
      ...content,
      seasons: { ...content.seasons, months: content.seasons.months.map(() => 12) },
    };
    const w = createWorld(createSim(warm), 'ledger');
    step(w, createSim(warm), 5 * DAY);
    const kinds = furnitureOf(w).map((f) => f['kind']);
    expect(kinds.filter((k) => k === 'hearth')).toHaveLength(1);
    const lines = allLines(w);
    expect(lines.filter((e) => e.type === 'fire.plannedCold')).toHaveLength(0);
    expect(lines.filter((e) => e.type === 'fire.planned')).toHaveLength(1);
  });

  it('heats a room from its hearth, falling with distance, and the open only to its radius', () => {
    const w = createWorld(sim, 'ledger');
    step(w, sim, 4 * DAY);
    const fire = firesOf(w).find((f) => f['lit'] && f['banked'] === 0);
    expect(fire).toBeDefined();
    const piece = furnitureOf(w).find((p) => p.id === fire!['piece'])!;
    const [x, y] = [piece['x'] as number, piece['y'] as number];
    const at = (dx: number) => heatAt(w, winter, y * w.map.width + x + dx);
    const { fuels, fall, radius } = content.work.fire;
    expect(at(0)).toBe(fuels[0]!.heat);
    if (!roomAt(w, winter, x, y)) {
      expect(at(1)).toBe(fuels[0]!.heat - fall);
      expect(at(radius + 1)).toBe(0);
    }
  });

  it('puts a fire out with a line that leads back to the empty Firewood plate', () => {
    const w = createWorld(sim, 'ledger');
    step(w, sim, 3 * DAY);
    expect(firesOf(w).some((f) => f['lit'])).toBe(true);
    // The colony wants no firewood, and what there is has gone.
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'firewood', level: 'none' },
    });
    step(w, sim, 1);
    for (const i of w.entities['item'] ?? [])
      if (i['kind'] === 'firewood') removeEntity(w, 'item', i.id);
    const from = w.nextEventId;
    step(w, sim, 2 * DAY);
    const out = allLines(w).find((e) => e.id >= from && e.type === 'fire.out')!;
    expect(out).toBeDefined();
    const plate = stockOf(w, 'firewood')!;
    expect(plate['level']).toBe('none');
    expect(out.causes).toContain(plate['line']);
    expect(whyOf(w, out.id).map((c) => c.event.type)).toContain('goods.stockSet');
  });

  it('keeps tending an indirect lever: a Work sheet row and no command to light or place a fire', () => {
    const kinds = SYSTEMS.flatMap((s) => Object.keys(s.commands ?? {}));
    expect(kinds.filter((k) => /fire|hearth|tend|light/i.test(k))).toEqual([]);
    const jobs = content.work.priority.jobs;
    expect(jobs.indexOf('tend')).toBe(jobs.indexOf('haul') + 1);
    // Raising the band's Tend gets them tending, their taking-up lines citing it.
    const w = createWorld(sim, 'tallow');
    for (const p of people(w))
      submitCommand(w, {
        tick: w.tick + 1,
        kind: 'setPriority',
        data: { person: p.id, job: 'tend', level: 1 },
      });
    step(w, sim, 3 * DAY);
    const mine = allLines(w).filter((e) => e.type === 'work.tookUpTending');
    expect(mine.length).toBeGreaterThan(0);
    for (const line of mine)
      expect(whyOf(w, line.id).map((c) => c.event.type)).toContain('work.prioritySet');
  });
});

describe('a cold room with no floor for a hearth', () => {
  /** The `fire.noFloor` lines of a winter world whose rooms' floors were filled with chests the
   * minute they stood, before a hearth could be planned. */
  function noFloorLines(seed: string) {
    const w = createWorld(sim, seed);
    for (let m = 0; m < 5 * 24 * 12 && !roomsOf(w, winter).length; m += 1) step(w, sim, 5);
    for (const rr of roomsOf(w, winter)) {
      const taken = new Set(
        furnitureOf(w).map((f) => (f['y'] as number) * w.map.width + (f['x'] as number)),
      );
      // Not the tile just inside the door: it stays clear as the way in, and someone can stand there.
      const wayIn = rr.room.doorTiles.flatMap((d) => [
        d - 1,
        d + 1,
        d - w.map.width,
        d + w.map.width,
      ]);
      for (const i of rr.room.tiles.filter((t) => !taken.has(t) && !wayIn.includes(t)))
        addEntity(w, 'furniture', {
          ...{ kind: 'chest', x: i % w.map.width, y: Math.floor(i / w.map.width), z: 0 },
          ...{ facing: 's', quality: 0, maker: 0, owner: 0, made: 0, line: 0, state: 'built' },
          ...{ have: 0, work: -1, waited: 0 },
        });
    }
    step(w, sim, 2 * DAY);
    return allLines(w).filter((e) => e.type === 'fire.noFloor');
  }

  // Whether a hearth is planned in the very hour a room stands depends on who is inside then, so
  // search the seed list for a world that shows the alert.
  it('says so once, on the alert line, citing the cold', () => {
    const said = SEEDS.map(noFloorLines).find((lines) => lines.length > 0);
    expect(said).toBeDefined();
    expect(new Set(said!.map((e) => e.data['room'])).size).toBe(said!.length);
    expect(said![0]!.causes.length).toBeGreaterThan(0);
  });
});
