// 6C Slice 3 (V-225): the lord's asks. He brings one at his first tithe visit, citing it; the colony
// takes it up or lets it pass, naming nobody; letting it pass costs favour with a line; a taken-up
// fine blade is made by the colony's best smith unordered, citing the ask; under the Lord law one
// who would refuse him never works his ask.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  emit,
  itemsOf,
  layItem,
  restOf,
  step,
  storeOf,
  submitCommand,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  today,
  whyOf,
  withoutAccidents,
  yearNow,
} from '../index.ts';
import { reeveRow } from '../lord/index.ts';
import { contextFor } from '../sim/system.ts';
import { addAsk } from './index.ts';
import { asksSystem } from './system.ts';
import { willWork } from '../crafts/askmade.ts';
import { addMemory } from '../needs/index.ts';

const content = withoutAccidents(game);
type World = ReturnType<typeof createWorld>;
type Sim = ReturnType<typeof createSim>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const people = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const asks = (w: World) => w.entities['ask'] ?? [];

/** A harvest home brought in today and its supper eaten (as lord.test.ts). */
function harvestHome(w: World, sim: Sim): number {
  const home = emit(w, sim.templates, 'farm.harvestHome', {
    causes: [w.begunEvent],
    data: { names: 'the band', crop: 'turnips', count: 2000, what: 'turnips' },
  });
  addEntity(w, 'feast', {
    ...{ line: home, year: yearNow(w, content), state: 'eaten', start: 0, there: [] },
    ...{ eaten: home, couple: [], on: today(w), holy: 0, lean: 0 },
  });
  return home;
}

/** To the next midnight, then on until the reeve has come and gone. */
function visit(w: World, sim: Sim): void {
  harvestHome(w, sim);
  step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
  for (let h = 0; h < 24 && !(reeveRow(w) === undefined && h > 8); h += 1)
    step(w, sim, TICKS_PER_HOUR);
}

describe("the lord's asks", () => {
  it('come at his first tithe visit citing it, and letting one pass costs favour with a line', () => {
    const sim = createSim(content);
    const w = createWorld(sim, 'smoke/1');
    step(w, sim, TICKS_PER_HOUR);
    visit(w, sim);
    expect(lines(w, 'lord.asked')).toEqual([]);
    visit(w, sim);
    const [asked] = lines(w, 'lord.asked');
    const tithed = lines(w, 'lord.tithed').at(-1)!;
    expect(asked!.causes).toContain(tithed.id);
    const ask = asks(w)[0]!;
    expect(ask['state']).toBe('open');
    expect(ask['line']).toBe(asked!.id);
    // The colony lets it pass: a lever naming no one.
    submitCommand(w, { tick: w.tick + 1, kind: 'passAsk', data: { ask: ask.id } });
    step(w, sim, 2);
    const [letPass] = lines(w, 'ask.letPass');
    expect(letPass).toBeDefined();
    visit(w, sim);
    const [passed] = lines(w, 'ask.passed');
    expect(passed!.causes).toContain(letPass!.id);
    const cost = lines(w, 'lord.favour').find((e) => e.data['cause'] === 'askPassed')!;
    expect(cost.causes).toContain(passed!.id);
    expect(cost.data['way']).toBe('falls');
    expect(String(cost.data['text'])).toContain(String(ask['what']));
    // His next ask came at the same visit.
    expect(lines(w, 'lord.asked')).toHaveLength(2);
  });
});

/** A plain-seed world with a standing forge beside the cart, bronze and charcoal in the store, an
 * ask for a fine blade taken up at priority 1, and two able smiths: `best` and `next`. */
function blade(seed: string) {
  const sim = createSim(content);
  const w = createWorld(sim, seed);
  w.map.known.fill(1);
  w.map.places = [];
  const begun = w.begunEvent;
  const spot = restOf(w, content);
  addEntity(w, 'furniture', {
    ...{ kind: 'forge', x: spot.x + 1, y: spot.y, z: 0, facing: 's', quality: 0, maker: 0 },
    ...{ owner: 0, made: begun, line: begun, state: 'built', have: 0, work: 0, waited: 0 },
  });
  for (const [kind, count] of [
    ['bronze-ingot', 6],
    [content.tools.charcoal, 3],
  ] as const) {
    const at = storeOf(w).find(
      (s) => !itemsOf(w).some((i) => i['x'] === s['x'] && i['y'] === s['y']),
    )!;
    layItem(w, { kind, count, x: at['x'] as number, y: at['y'] as number, z: 0, made: begun });
  }
  const skill = content.jobs.find((j) => j.id === content.tools.job)!.skill!;
  w.entities['skill'] = (w.entities['skill'] ?? []).filter((s) => s['skill'] !== skill);
  // The lesser smith comes first in the people's order, so the best must be waited for.
  const [next, best] = people(w);
  for (const p of [best!, next!]) p['strength'] = 12;
  addEntity(w, 'skill', { person: best!.id, skill, level: 12, xp: 0 });
  addEntity(w, 'skill', { person: next!.id, skill, level: 4, xp: 0 });
  const line = emit(w, sim.templates, 'lord.asked', {
    causes: [begun],
    data: { reeve: 'Osric', lord: 'Lord Aldred', what: 'a fine blade for his hall', due: '' },
  });
  const ctx = contextFor(w, sim, asksSystem);
  const ask = addAsk(ctx, {
    ...{ source: 'lord', asker: 'Lord Aldred', what: 'a fine blade for his hall' },
    ...{ tool: 'blade', quality: 'fine', count: 1, cite: begun, line, due: 0 },
  });
  submitCommand(w, { tick: w.tick + 1, kind: 'takeAsk', data: { ask: ask.id, level: 1 } });
  return { sim, w, best: best!, next: next!, ask, line, ctx };
}

describe('working an ask', () => {
  it("is the colony's best smith's, unordered, and the blade's line cites the ask", () => {
    const { sim, w, best, line } = blade('ledger');
    const commands = w.commandLog.length;
    step(w, sim, 3 * TICKS_PER_DAY);
    expect(w.commandLog).toHaveLength(commands);
    const made = lines(w, 'ask.made')[0]!;
    expect(made.actors).toEqual([best.id]);
    expect(String(made.data['what'])).toMatch(/blade/);
    expect(made.data['fit']).toBe('');
    expect(made.causes).toContain(line);
    const why = whyOf(w, made.id).map((c) => c.event.type);
    expect(why).toContain('ask.tookUp');
    expect(why).toContain('ask.taken');
    // The blade lies with the cart, fine or better.
    const piece = itemsOf(w).find((i) => i['made'] === made.id)!;
    expect(piece['kind']).toBe('bronze-blade');
  });

  it('is never worked, under the Lord law, by one who would refuse him', () => {
    const { sim, w, best, next, ask, ctx } = blade('ledger');
    // The best smith has turned against the lord: greedy and hot-tempered, and bitter.
    for (const trait of ['greedy', 'hot-tempered'])
      addEntity(w, 'trait', { person: best.id, trait });
    for (const memory of ['lean-tithe', 'lord-bitter'])
      addMemory(ctx, best.id, memory, w.begunEvent);
    expect(willWork(ctx, best, ask)).toBe(false);
    expect(willWork(ctx, next, ask)).toBe(true);
    step(w, sim, 3 * TICKS_PER_DAY);
    const made = lines(w, 'ask.made')[0]!;
    expect(made.actors).toEqual([next.id]);
    expect(lines(w, 'ask.tookUp').every((e) => !e.actors.includes(best.id))).toBe(true);
  });
});
