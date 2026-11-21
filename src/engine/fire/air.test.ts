// 6B Bundle 2 (P6.10) done-whens: a room's air keeps its heat after its fire dies, and loses it at
// its walls' rate, so a stone room stays warm longer than a timber one. The Hearths law moves how
// each tender keeps a fire, by their own answer to it, never by an order.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { banks, tendRule } from '../crafts/index.ts';
import {
  createSim,
  createWorld,
  furnitureOf,
  heatAt,
  roomAt,
  step,
  submitCommand,
  withoutAccidents,
} from '../index.ts';
import { airHour, airOf, firesOf, leakOf } from './index.ts';

const content = withoutAccidents(game);
const winter = {
  ...content,
  seasons: { ...content.seasons, months: content.seasons.months.map(() => -12) },
};
const sim = createSim(winter);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;

/** A world on the first winter day its first fire stands in a closed room (day 5 on ledger,
 * since knapping axes took a day in V-195), within ten days. */
function roomFire(seed: string): { w: World; fire: Record<string, unknown> & { id: number } } {
  const w = createWorld(sim, seed);
  const inRoom = () =>
    firesOf(w).find((f) => {
      const piece = furnitureOf(w).find((p) => p.id === f['piece'])!;
      return !!roomAt(w, winter, piece['x'] as number, piece['y'] as number);
    });
  for (let d = 0; d < 10 && !inRoom(); d++) step(w, sim, DAY);
  const fire = inRoom();
  expect(fire).toBeDefined();
  return { w, fire: fire! };
}

/** Every wall and door tile of the map rebuilt in `wall` and `door` (content part ids). */
function rebuild(w: World, wall: string, door: string): void {
  const parts = winter.buildings.parts;
  const at = (id: string) => parts.findIndex((p) => p.id === id) + 1;
  const built = w.map.built;
  for (let i = 0; i < built.length; i += 1) {
    const kind = parts[built[i]! - 1]?.kind;
    if (kind === 'wall') built[i] = at(wall);
    if (kind === 'door') built[i] = at(door);
  }
}

/** Hours the room keeps any air heat once its fire is out, from `air` tenths of a degree. */
function hoursWarm(w: World, fire: Record<string, unknown>, air: number): number {
  Object.assign(fire, { lit: 0, fuel: 0, banked: 0, air });
  let hours = 0;
  while ((fire['air'] as number) > 0 && hours < 500) {
    airHour(w, winter);
    hours += 1;
  }
  return hours;
}

describe('room air', () => {
  it('keeps a stone room warm longer than a timber one after the fire dies', () => {
    const { w, fire } = roomFire('ledger');
    const piece = furnitureOf(w).find((p) => p.id === fire['piece'])!;
    rebuild(w, 'wall-wood', 'door-wood');
    const timberLeak = leakOf(w, winter, piece);
    const timber = hoursWarm(w, fire, 160);
    rebuild(w, 'wall-stone', 'door-stone');
    const stoneLeak = leakOf(w, winter, piece);
    // While warm, the room's every tile feels the same air heat.
    Object.assign(fire, { air: 160 });
    const room = roomAt(w, winter, piece['x'] as number, piece['y'] as number)!;
    for (const i of room.tiles) expect(heatAt(w, winter, i)).toBe(16);
    const stone = hoursWarm(w, fire, 160);
    expect(stoneLeak).toBeLessThan(timberLeak);
    expect(stone).toBeGreaterThan(timber);
    expect(airOf(fire as never)).toBe(0);
  });
});

describe('the Hearths law at the hearth', () => {
  it('tends by each person’s own answer: keepers by the setting, refusers the old way', () => {
    const w = createWorld(sim, 'anvil');
    step(w, sim, 60);
    const set = (setting: string) => {
      submitCommand(w, { tick: w.tick + 1, kind: 'setLaw', data: { law: 'hearths', setting } });
      step(w, sim, 2);
    };
    const law = winter.laws.laws.find((l) => l.id === 'hearths')!;
    const custom = winter.work.fire.tend;
    for (const id of ['frugal', 'roaring']) {
      set(id);
      const hearth = law.settings.find((s) => s.id === id)!.hearth!;
      for (const a of (w.entities['answer'] ?? []).filter((r) => r['law'] === 'hearths')) {
        const p = w.entities['person']!.find((q) => q.id === a['person'])!;
        const rule = tendRule(w, winter, p);
        if (a['answer'] === 'refuses') {
          expect([rule.top, rule.bank, !!rule.flout]).toEqual([custom.top, true, true]);
        } else {
          expect([rule.top, rule.bank]).toEqual([hearth.top, hearth.bank]);
          expect(banks(w, winter, p)).toBe(hearth.bank);
        }
        // A cold grumbler under a law that banks stokes the old way, with a line to say so.
        if (a['answer'] === 'grumbles' && hearth.bank)
          expect(tendRule(w, winter, p, true).stoke).toBeDefined();
      }
    }
    set('steady');
    expect((w.entities['answer'] ?? []).filter((r) => r['law'] === 'hearths')).toEqual([]);
  });
});
