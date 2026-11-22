// 6B Bundle 3 (P6.11, amends V-056): a new house stands roofless, losing warmth, until a thatcher
// takes it up unordered and thatches it; with no reed or straw in reach it says so once and waits,
// and a reaped field's straw thatches it; worn thatch is laid again.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { greenOf, roofLeak, roofsWanted, rectOf, slateCanBeHad } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import type { EntityRow } from '../core/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  withoutAccidents,
} from '../index.ts';

const content = withoutAccidents(game);
const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const houses = (w: World) => w.entities['house'] ?? [];

/** Steps an hour at a time until a line of `type` appears, at most `days` days; its row. */
function until(w: World, type: string, days: number) {
  for (let h = 0; h < days * 24; h += 1)
    for (const e of step(w, sim, 60)) if (e.type === type) return e;
  return undefined;
}

const inside = (w: World, h: EntityRow) => {
  const r = rectOf(h);
  return roofLeak(w, content, r.x + 1, r.y + 1);
};

describe('roofs and the thatcher', () => {
  it('a new house stands roofless until a thatcher thatches it, unordered', () => {
    // Seeds with reed in reach of the green.
    for (const seed of ['anvil', 'tallow']) {
      const w = createWorld(sim, seed);
      const built = until(w, 'build.houseBuilt', 30)!;
      const h = houses(w).find((r) => r['built'] === built.id)!;
      expect(inside(w, h)).toBe(content.buildings.roofs.open);
      const roofed = until(w, 'build.roofed', 10)!;
      expect(roofed, seed).toBeDefined();
      const took = allLines(w).find((e) => e.id === roofed.causes[0])!;
      expect(took.type).toBe('work.tookUpThatching');
      expect(took.causes).toContain(built.id);
      expect(String(roofed.data['what'])).toMatch(/reed|straw/);
      const done = houses(w).find((r) => r['roofLine'] === roofed.id)!;
      expect(done['roof']).toBe('thatch');
      expect(inside(w, done)).toBe(0);
    }
  });

  it('with no reed or straw it says so once and waits; a reaped field thatches it with straw', () => {
    const w = createWorld(sim, 'ledger-1');
    // No reed: on the 250-tile valley (V-202) every seed tried had marsh within reach, so the
    // marsh here is dried to grass before anyone looks (2026-11-22: 10 seeds).
    const kinds = content.terrain.kinds;
    const [marsh, grass] = ['marsh', 'grass'].map((id) => kinds.findIndex((k) => k.id === id));
    w.map.tiles.forEach((t, i) => {
      if (t === marsh) w.map.tiles[i] = grass!;
    });
    const built = until(w, 'build.houseBuilt', 30)!;
    step(w, sim, 2 * DAY);
    const main = houses(w).find((r) => r['built'] === built.id)!;
    expect(main['roof']).toBeFalsy();
    expect(
      allLines(w).filter((e) => e.type === 'build.noThatch' && e.causes.includes(built.id)),
    ).toHaveLength(1);
    // A field reaped near the green left straw.
    const g = greenOf(w);
    const tiles = [...Array(32).keys()].map(
      (i) => (g.y + 6 + (i >> 3)) * w.map.width + g.x + (i % 8) - 4,
    );
    addEntity(w, 'field', {
      ...{ crop: 'barley', state: 'fallow', tiles, done: [], sown: 5, line: 1, last: 1, took: 0 },
      ...{ why: '', sent: 0, leave: 0, got: 0, kept: 0, reapers: [], noSeed: 0, at: tiles[0]! },
      ...{ course: 0, prev: '', rested: 0, straw: 8 },
    });
    // The player's lever: Thatching raised for the band (V-041); nobody is told which roof.
    for (const p of w.entities['person'] ?? [])
      submitCommand(w, {
        tick: w.tick + 1,
        kind: 'setPriority',
        data: { person: p.id, job: 'thatch', level: 1 },
      });
    const roofed = until(w, 'build.roofed', 4)!;
    expect(roofed.data['what']).toBe('straw');
    const took = allLines(w).find((e) => e.id === roofed.causes[0])!;
    expect(
      allLines(w).find((e) => took.causes.includes(e.id) && e.type === 'work.prioritySet'),
    ).toBeDefined();
  });

  it('thatch wears over the years and is laid again where no slate can be had', () => {
    // Tallow has no boulder by slate rock (where slate can be had the mason slates it: mason.test).
    const w = createWorld(sim, 'tallow');
    const first = until(w, 'build.roofed', 30)!;
    const h = houses(w).find((r) => r['roofLine'] === first.id)!;
    expect(roofsWanted(w, content)).not.toContain(h);
    const year = content.calendar.daysPerMonth * content.calendar.monthsPerYear * DAY;
    h['roofed'] = w.tick - content.buildings.roofs.thatch.wears * year;
    expect(slateCanBeHad(w, content)).toBe(false);
    expect(roofsWanted(w, content)).toContain(h);
    expect(inside(w, h)).toBe(content.buildings.roofs.thatch.worn);
    let again;
    for (let i = 0; i < 6 && !again; i += 1) {
      const e = until(w, 'build.roofed', 1);
      if (e && houses(w).find((r) => r['roofLine'] === e.id)?.id === h.id) again = e;
    }
    const took = allLines(w).find((e) => e.id === again!.causes[0])!;
    expect(String(took.data['why'])).toMatch(/worn/);
    expect(inside(w, h)).toBe(0);
  });
});
