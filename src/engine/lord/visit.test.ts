// 6C Slice 7 part 2 (V-236, V-240): the lord comes himself to every third harvest home's supper;
// the Feasts law sets his table and his favour moves with a line; the elder may plead in a lean
// year, at most once in three; a hothead may speak out, and a cruel lord has them beaten.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { Content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  emit,
  step,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  today,
  yearNow,
  withoutAccidents,
} from '../index.ts';
import { colonyRow } from '../colony/index.ts';
import { addMemory } from '../needs/index.ts';
import { contextFor } from '../sim/system.ts';
import { lordRow, reeveRow } from './index.ts';
import { favourOf } from './favour.ts';
import { lordSystem } from './system.ts';

type World = ReturnType<typeof createWorld>;
type Sim = ReturnType<typeof createSim>;
const SEED = 'smoke/1';
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** A harvest home brought in now, its supper called for tonight (eaten already when `eaten`). */
function harvestHome(w: World, sim: Sim, eaten: boolean): number {
  const home = emit(w, sim.templates, 'farm.harvestHome', {
    causes: [w.begunEvent],
    data: { names: 'the band', crop: 'turnips', count: 2000, what: 'turnips' },
  });
  addEntity(w, 'feast', {
    ...{ line: home, year: yearNow(w, content), state: eaten ? 'eaten' : 'called', start: 0 },
    ...{ there: [], eaten: eaten ? home : 0, couple: [], on: today(w), holy: 0, lean: 0 },
  });
  return home;
}

/** Steps until the reeve (and the lord with him) has come and gone, at most two days. */
function untilGone(w: World, sim: Sim): void {
  let seen = false;
  for (let h = 0; h < 48; h += 1) {
    step(w, sim, TICKS_PER_HOUR);
    if (reeveRow(w)) seen = true;
    else if (seen) return;
  }
}

/** A world whose lord was named at the first harvest home, early on a later day. */
function named(sim: Sim): World {
  const w = createWorld(sim, SEED);
  step(w, sim, TICKS_PER_HOUR);
  harvestHome(w, sim, true);
  step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
  untilGone(w, sim);
  step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) + TICKS_PER_HOUR);
  return w;
}

/** A copy of `base` whose next harvest home is the `homes`th: 2 a reeve's year, 3 the lord's. */
function before(base: World, homes: number): World {
  const w = structuredClone(base);
  lordRow(w)!['visits'] = homes - 2;
  return w;
}

/** Takes every bite of food out of the valley, so the year is lean. */
function emptyStore(w: World): void {
  const food = new Set(Object.keys(content.life.eat));
  w.entities['item'] = (w.entities['item'] ?? []).filter((i) => !food.has(i['kind'] as string));
}

const withHotheads = (c: Content): Content => {
  const x = structuredClone(c);
  Object.assign(x.lord.visit.hothead, { odds: 100, most: 100, beat: ['bold', 'cruel'] });
  return x;
};

describe("the lord's visit", () => {
  const sim = createSim(withoutAccidents(content));
  const base = named(sim);

  it('comes himself to the third harvest-home supper, his table moving his favour', () => {
    const w = before(base, 3);
    const home = harvestHome(w, sim, false);
    untilGone(w, sim);
    const [came] = lines(w, 'lord.came');
    expect(came!.causes).toContain(home);
    expect(came!.data['first']).toContain('has not come before');
    expect(lines(w, 'lord.reeveCame')).toHaveLength(1);
    const [supper] = lines(w, 'lord.supper');
    expect(supper!.causes).toContain(came!.id);
    expect(supper!.data['setting']).toBe('Customary');
    const table = lines(w, 'lord.favour').find((e) => e.data['cause'] === 'table-customary');
    expect(table!.causes).toEqual([supper!.id]);
    // He stays the night: the reeve counts the tithe in the morning, then they ride out.
    const [tithed] = lines(w, 'lord.tithed');
    expect(Math.floor(tithed!.tick / TICKS_PER_DAY)).toBe(
      Math.floor(came!.tick / TICKS_PER_DAY) + 1,
    );
    const [out] = lines(w, 'lord.rodeOut');
    expect(out!.causes).toEqual([came!.id]);
    expect(out!.tick).toBeGreaterThan(tithed!.tick);
    expect(reeveRow(w)).toBeUndefined();
  });

  it('sends only the reeve in other years', () => {
    const w = before(base, 2);
    harvestHome(w, sim, false);
    untilGone(w, sim);
    expect(lines(w, 'lord.came')).toHaveLength(0);
    expect(lines(w, 'lord.tithed')).toHaveLength(1);
  });

  it('hears the elder in a lean year, by temper and favour, at most once in three years', () => {
    const w = before(base, 2);
    const elder = (w.entities['person'] ?? []).find((p) => p['status'] === 'alive')!;
    colonyRow(w)!['elder'] = elder.id;
    lordRow(w)!['temper'] = 'pious';
    emptyStore(w);
    harvestHome(w, sim, true);
    step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
    untilGone(w, sim);
    const [plea] = lines(w, 'lord.plea');
    expect(plea!.actors).toEqual([elder.id]);
    expect(plea!.data['eased']).toBe('whole');
    const [tithed] = lines(w, 'lord.tithed');
    expect(tithed!.data['tookN']).toBe(0);
    expect(
      (w.entities['memory'] ?? []).some(
        (m) => m['line'] === plea!.id && m['memory'] === 'plea-heard',
      ),
    ).toBe(true);
    // A bold lord below the half gate refuses, and it costs favour; the next lean year is too soon.
    const later = before(base, 2);
    colonyRow(later)!['elder'] = elder.id;
    lordRow(later)!['temper'] = 'bold';
    emptyStore(later);
    addEntity(later, 'favour', { cause: 'test', by: -10, text: 'test', line: 0, until: 1e9 });
    for (let k = 0; k < 2; k += 1) {
      harvestHome(later, sim, true);
      step(later, sim, TICKS_PER_DAY - (later.tick % TICKS_PER_DAY));
      untilGone(later, sim);
    }
    const pleas = lines(later, 'lord.plea');
    expect(pleas).toHaveLength(1);
    expect(pleas[0]!.data['eased']).toBe('no');
    const cost = lines(later, 'lord.favour').find((e) => e.data['cause'] === 'plea');
    expect(cost!.causes).toEqual([pleas[0]!.id]);
  });

  it('halves the tithe for a bold lord once his favour is at the gate of 50 (6C review q3)', () => {
    const w = before(base, 2);
    colonyRow(w)!['elder'] = (w.entities['person'] ?? []).find((p) => p['status'] === 'alive')!.id;
    lordRow(w)!['temper'] = 'bold';
    emptyStore(w);
    const ctx = contextFor(w, sim, lordSystem);
    // Favour exactly 50, the approved gate (it was 60).
    addEntity(w, 'favour', {
      cause: 'test',
      by: 50 - favourOf(ctx),
      text: 't',
      line: 0,
      until: 1e9,
    });
    harvestHome(w, sim, true);
    step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
    untilGone(w, sim);
    const [plea] = lines(w, 'lord.plea');
    expect(plea!.data['eased']).toBe('half');
    expect(lines(w, 'lord.favour').some((e) => e.data['cause'] === 'plea')).toBe(false);
  });

  it('lets a hothead speak out at his table, and a cruel lord has them beaten', () => {
    const hot = createSim(withoutAccidents(withHotheads(content)));
    const w = before(base, 3);
    const ctx = contextFor(w, hot, lordSystem);
    for (const p of w.entities['person'] ?? [])
      if (p['status'] === 'alive') addMemory(ctx, p.id, 'lean-tithe', w.begunEvent);
    lordRow(w)!['temper'] = 'cruel';
    harvestHome(w, hot, false);
    untilGone(w, hot);
    const [said] = lines(w, 'lord.hothead');
    const [supper] = lines(w, 'lord.supper');
    expect(said!.causes).toEqual([supper!.id]);
    expect(supper!.actors).toContain(said!.actors[0]);
    const cost = lines(w, 'lord.favour').find((e) => e.data['cause'] === 'hothead');
    expect(cost!.causes).toEqual([said!.id]);
    const [beaten] = lines(w, 'lord.beaten');
    expect(beaten!.actors).toEqual(said!.actors);
    const hurt = lines(w, 'health.hurt').find((e) => e.causes.includes(beaten!.id));
    expect(hurt!.actors).toEqual(said!.actors);
  });
});
