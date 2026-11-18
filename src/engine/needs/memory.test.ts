// V-154, V-146: a memory's weight decides how long it stays (light fades, heavy lingers without
// mood a season after it last came, lasting stays for life); a run of hunger days makes "The
// hungry {season}"; the same food day after day is remembered; the thought line's order.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, type SystemContext } from '../index.ts';
import { tasted } from './diet.ts';
import { addMemory, bandOf, expireMemories, heldMemoriesOf, memoriesOf } from './memory.ts';
import { memoryName, thoughtOf } from './thought.ts';

const DAY = 1440;
const sim = createSim(content);
const fresh = () => {
  const w = createWorld(sim, 'anvil/1');
  const ctx = { world: w, content } as unknown as SystemContext;
  const [a, b] = (w.entities['person'] ?? []).map((p) => p.id);
  return { w, ctx, a: a!, b: b! };
};
const row = (w: ReturnType<typeof createWorld>, p: number, id: string) =>
  heldMemoriesOf(w, p).find((m) => m['memory'] === id);
const { lingerDays, heavy } = content.life.memory;

describe('memory weights', () => {
  it('a run of hungry days turns heavy, lingers without mood, then goes; a meal never does', () => {
    const { w, ctx, a } = fresh();
    for (let d = 0; d < 7; d += 1) {
      addMemory(ctx, a, 'went-hungry', 5);
      addMemory(ctx, a, 'ate-well', 6);
      if (d === 0) expect(row(w, a, 'went-hungry')!['weight']).toBe(2); // 1, and a first time
      w.tick += DAY;
    }
    // Seven days in four weeks: one more point, so heavy, and named for the season it began.
    expect(row(w, a, 'went-hungry')!['weight']).toBe(heavy);
    expect(bandOf(content, heavy)).toBe('heavy');
    expect(memoryName(w, content, row(w, a, 'went-hungry')!)).toBe('The hungry spring');
    expect(bandOf(content, row(w, a, 'ate-well')!['weight'] as number)).toBe('light');
    // Past its four fresh days it gives no mood but stays; the meal has gone.
    w.tick += 5 * DAY;
    expireMemories(w, content);
    expect(memoriesOf(w, a).map((m) => m['memory'])).toEqual([]);
    expect(heldMemoriesOf(w, a).map((m) => m['memory'])).toEqual(['went-hungry']);
    // It goes `lingerDays` after it last came.
    const last = row(w, a, 'went-hungry')!['last'] as number;
    w.tick = (last + lingerDays) * DAY - 60;
    expireMemories(w, content);
    expect(row(w, a, 'went-hungry')).toBeDefined();
    w.tick += 60;
    expireMemories(w, content);
    expect(row(w, a, 'went-hungry')).toBeUndefined();
  });

  it('a death of someone close is lasting; a second time weighs less than the first', () => {
    const { w, ctx, a, b } = fresh();
    addMemory(ctx, a, 'grief', 5, b);
    expect(bandOf(content, row(w, a, 'grief')!['weight'] as number)).toBe('lasting');
    w.tick += 400 * DAY;
    expireMemories(w, content);
    expect(row(w, a, 'grief')).toBeDefined();
    expect(memoriesOf(w, a)).toEqual([]);
    // A first time touches more: the same light memory again later is a point lighter.
    addMemory(ctx, a, 'culled-raised', 7);
    const first = row(w, a, 'culled-raised')!['weight'] as number;
    w.tick += 10 * DAY;
    expireMemories(w, content);
    addMemory(ctx, a, 'culled-raised', 8);
    expect(row(w, a, 'culled-raised')!['weight']).toBe(first - 1);
  });

  it('two weeks of the same two foods leave a memory; a third food in that time does not', () => {
    const { w, ctx, a, b } = fresh();
    const { days, memory } = content.life.memory.sameFood;
    for (let d = 0; d <= days; d += 1) {
      tasted(ctx, a, d % 2 ? 'meal' : 'stew', 9);
      tasted(ctx, b, d % 3 === 0 ? 'meal' : d % 3 === 1 ? 'stew' : 'bread', 9);
      if (d < days) expect(row(w, a, memory)).toBeUndefined();
      w.tick += DAY;
    }
    expect(row(w, a, memory)!['line']).toBe(9);
    expect(row(w, b, memory)).toBeUndefined();
  });
});

describe('the thought line', () => {
  it('is a need under its line first, then a new memory, then the strongest, else none', () => {
    const { w, ctx, a, b } = fresh();
    expect(thoughtOf(w, content, a).text).toBe(content.life.memory.thoughts.none[0]);
    addMemory(ctx, a, 'grief', 11, b);
    w.tick += 7 * 60;
    addMemory(ctx, a, 'ate-well', 12);
    // The meal is new: it speaks over the grief.
    const meal = thoughtOf(w, content, a);
    expect(content.memories.find((m) => m.id === 'ate-well')!.thoughts).toContain(meal.text);
    expect(meal.why).toBe(12);
    // Seven hours on, the strongest (the lasting grief) speaks, naming whom it is about.
    w.tick += 7 * 60;
    const name = (w.entities['person'] ?? []).find((p) => p.id === b)!['name'] as string;
    expect(thoughtOf(w, content, a)).toMatchObject({ why: 11 });
    expect(thoughtOf(w, content, a).text).toContain(name);
    // A need under its warning line comes before every memory, citing its low line.
    const food = (w.entities['need'] ?? []).find((n) => n['person'] === a && n['need'] === 'food')!;
    Object.assign(food, { value: 100, low: 1, line: 13 });
    const hungry = thoughtOf(w, content, a);
    expect(content.life.needs.find((n) => n.id === 'food')!.thoughts).toContain(hungry.text);
    expect(hungry.why).toBe(13);
  });
});
