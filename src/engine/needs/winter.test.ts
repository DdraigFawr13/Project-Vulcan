// V-091, V-092, P5.5: memories hold, stack, fade and move the mood; each settler arrives in a wool
// tunic and cloak that warm them outdoors and wear through; a cold line is notable once a person a
// day.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addMemory,
  allLines,
  createSim,
  createWorld,
  memoriesOf,
  moodOf,
  needOf,
  step,
  type SystemContext,
} from '../index.ts';
import { itemsOf } from '../goods/index.ts';

// Every month at -20 degrees: a winter that never lets up. `garment` changes every garment.
type Garment = (typeof content.clothes.garments)[number];
const coldWith = (garment: Partial<Garment>) => ({
  ...content,
  clothes: {
    ...content.clothes,
    garments: content.clothes.garments.map((g) => ({ ...g, ...garment })),
  },
  seasons: { ...content.seasons, months: content.seasons.months.map(() => -20) },
});
const DAY = 1440;
const SEED = 'anvil/2';
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];
const cloaks = (w: World) => itemsOf(w).filter((i) => i['state'] === 'worn');
const lifeOf = (kind: string) => content.clothes.garments.find((g) => g.item === kind)!.last;
const warmthOf = (w: World) =>
  people(w).reduce((n, p) => n + (needOf(w, p.id, 'warmth')!['value'] as number), 0);

describe('memories', () => {
  it('hold, stack to their limit, move the mood and fade', () => {
    const sim = createSim(content);
    const w = createWorld(sim, SEED);
    const ctx = { world: w, content } as unknown as SystemContext;
    const [a, b] = [people(w)[0]!.id, people(w)[1]!.id];
    // One that does not stack is refreshed, not doubled.
    addMemory(ctx, a, 'ate-well', 1);
    step(w, sim, DAY);
    const first = memoriesOf(w, a)[0]!['until'] as number;
    addMemory(ctx, a, 'ate-well', 2);
    expect(memoriesOf(w, a)).toHaveLength(1);
    expect(memoriesOf(w, a)[0]!['until']).toBeGreaterThan(first);
    expect(memoriesOf(w, a)[0]!['line']).toBe(2);
    // One that stacks holds up to `stacks`, then refreshes.
    for (let k = 0; k < 5; k += 1) addMemory(ctx, b, 'cold-night', 3);
    expect(memoriesOf(w, b)).toHaveLength(3);
    addMemory(ctx, b, 'no-such-memory', 3);
    expect(memoriesOf(w, b)).toHaveLength(3);
    // The mood is the needs' mean plus the live memories' points times the weight.
    step(w, sim, 60);
    let [sum, weights] = [0, 0];
    for (const def of content.life.needs) {
      sum += (needOf(w, b, def.id)!['value'] as number) * def.weight;
      weights += def.weight;
    }
    const memory = -5 * 3 * content.life.memory.weight;
    const expected = Math.max(0, Math.floor(sum / weights) + memory);
    expect(moodOf(w, b)!['value']).toBe(expected);
    // They fade after their days (meals eaten meanwhile leave memories of their own).
    step(w, sim, 6 * DAY);
    expect(memoriesOf(w, b).filter((m) => m['memory'] === 'cold-night')).toEqual([]);
  });
});

describe('clothes', () => {
  it('arrive worn, a tunic and a cloak a settler, citing the unloading, and warm them outdoors', () => {
    const w = createWorld(createSim(content), SEED);
    expect(cloaks(w)).toHaveLength(people(w).length * content.clothes.cart.length);
    const unloaded = allLines(w).find((e) => e.type === 'goods.unloaded')!;
    for (const c of cloaks(w)) {
      const wear = lifeOf(c['kind'] as string);
      expect(c).toMatchObject({ state: 'worn', wear, quality: 'plain', made: unloaded.id });
      expect(c['holder']).toBe(c['owner']);
    }
    // A worn cloak is not a load: nobody carries it to the store, and it stays on its owner.
    const cold = createSim(coldWith({}));
    const bare = createSim(coldWith({ warmth: 0 }));
    const [clothed, naked] = [createWorld(cold, SEED), createWorld(bare, SEED)];
    // Warmth summed over the hours of three days (the cold is mostly met by the campfire).
    let [dressed, undressed] = [0, 0];
    for (let h = 0; h < 72; h += 1) {
      step(clothed, cold, 60);
      step(naked, bare, 60);
      [dressed, undressed] = [dressed + warmthOf(clothed), undressed + warmthOf(naked)];
    }
    expect(cloaks(clothed)).toHaveLength(people(clothed).length * content.clothes.cart.length);
    expect(dressed).toBeGreaterThan(undressed);
  });

  it('wear through in the cold, with a line citing the arrival', () => {
    const sim = createSim(coldWith({ last: 6 }));
    const w = createWorld(sim, SEED);
    const n = people(w).length;
    step(w, sim, DAY);
    expect(cloaks(w)).toEqual([]);
    const out = allLines(w).filter((e) => e.type === 'goods.wornOut');
    expect(out).toHaveLength(n * content.clothes.cart.length);
    const unloaded = allLines(w).find((e) => e.type === 'goods.unloaded')!;
    for (const e of out) expect(e.causes).toEqual([unloaded.id]);
  });
});

describe('quiet winter', () => {
  it('writes a cold line notable at most once a person a day, other needs staying notable', () => {
    const sim = createSim(coldWith({ warmth: 0 }));
    const w = createWorld(sim, SEED);
    step(w, sim, 6 * DAY);
    const notable = sim.notable;
    const lows = allLines(w).filter((e) => e.type === 'need.low');
    const cold = lows.filter((e) => e.data['need'] === 'warmth');
    const loud = new Map<string, number>();
    for (const e of cold.filter(notable)) {
      const key = `${e.actors[0]}:${Math.floor(e.tick / DAY)}`;
      loud.set(key, (loud.get(key) ?? 0) + 1);
    }
    expect(cold.length).toBeGreaterThan(loud.size);
    expect([...loud.values()].every((v) => v === 1)).toBe(true);
    expect(lows.filter((e) => e.data['need'] !== 'warmth').every(notable)).toBe(true);
  });
});
