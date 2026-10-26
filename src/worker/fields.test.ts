// Fields, the Seed plate, clothes and memories as the page shows them (P4.7): the Build sheet's
// Fields level, need and rows with one send-back, the furrow frames by state, a field tile's page,
// the Work sheet's Farming and Cooking rows, the Seed plate and the person sheet's Wearing and
// Memories. Nothing here names a tile or a person to command (V-049).
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  addMemory,
  createSim,
  createWorld,
  fieldsOf,
  fieldTiles,
  step,
  submitCommand,
  type SimEvent,
  type Stub,
  type SystemContext,
} from '../engine/index.ts';
import { buildView } from './build.ts';
import { goodsOf, stockView } from './goods.ts';
import { walkersOf } from './people.ts';
import { tileView } from './views.ts';

const sim = createSim(content);
const DAY = 1440;
const lineOf = (e: SimEvent | Stub) =>
  ({ id: e.id, tick: e.tick, type: e.type, text: e.type }) as never;

describe('field views', () => {
  it('shows the Fields level, its need in tiles and a planned field with one send-back', () => {
    const w = createWorld(sim, 'ledger');
    while (!fieldsOf(w).length && w.tick < DAY) step(w, sim, 10);
    const view = buildView(w);
    expect(view.fieldWant.level).toBe(content.buildings.field.start);
    expect(view.fieldNeed).toContain('tiles of crops');
    expect(view.fieldNeed).toContain('town ring');
    const field = view.fields[0]!;
    expect(field.why).toContain('good soil outside the town ring');
    expect(field.state).toBe('plan');
    expect(field.back).toBe(true);
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { field: field.id } });
    step(w, sim, 2);
    const next = buildView(w).fields[0]!;
    expect(next.id).not.toBe(field.id);
    expect(next.sent).toBe(true);
    expect(next.back).toBe(false);
  });

  it('draws furrows by state and gives a field tile its page', () => {
    const w = createWorld(sim, 'ledger');
    const frames = new Set<string>();
    let page: ReturnType<typeof tileView> | undefined;
    const doing = new Set<string>();
    // The first days half hour by half hour, when the band is sowing; then a day at a time.
    for (let n = 0; n < 6 * 48; n += 1) {
      step(w, sim, 30);
      for (const p of walkersOf(w)) doing.add(p.now.text);
      for (const f of goodsOf(w).fields) frames.add(f.frame);
    }
    // Until a field is sown and its page read (check:full budget).
    for (let day = 0; day < 130 && !page; day += 1) {
      step(w, sim, DAY);
      for (const f of goodsOf(w).fields) frames.add(f.frame);
      const field = fieldsOf(w).find((r) => r['state'] === 'sown');
      if (field && !page) {
        const i = fieldTiles(field)[0]!;
        page = tileView(w, i % w.map.width, Math.floor(i / w.map.width), 0, lineOf);
      }
    }
    expect([...doing].some((t) => /^Sowing the (barley|turnips)\.$/.test(t))).toBe(true);
    expect(frames.has('field.plan')).toBe(true);
    expect(frames.has('field.sown')).toBe(true);
    for (const f of frames) expect(f.startsWith('field.')).toBe(true);
    const field = page!.field!;
    expect(field.crop).toMatch(/^(barley|turnips), sown/);
    expect(field.name).toMatch(/ field$/);
    expect(field.harvest).toMatch(/^ripe in \d+ days?/);
    expect(field.frost).toContain('°C');
    // 5B Bundle 2: soil, the rotation's next crops, blight and water, in words.
    expect(field.soil).toMatch(/\d+ of 100/);
    expect(field.next).toContain(', then ');
    expect(field.blight).toMatch(/wet days? in the last 14|brown/);
    expect(field.water).toMatch(/water/);
    expect(field.seed).toContain('Seed plate');
    expect(field.why).toContain('fertility');
    expect(field.sited?.type).toBe('field.sited');
  });

  it('lists Farming and Cooking on the Work sheet and a Seed plate on the Stock sheet', () => {
    const w = createWorld(sim, 'ledger');
    const work = walkersOf(w)[0]!.work;
    expect(work.find((r) => r.job === 'farm')?.name).toBe('Farming');
    expect(work.find((r) => r.job === 'cook')?.name).toBe('Cooking');
    const seed = stockView(w).find((s) => s.good === 'seed')!;
    expect(seed.levels.map((l) => l.count)).toEqual([0, 100, 200]);
    expect(seed.have).toBeGreaterThan(0);
    // The Clothes plate lists spares by slot and what is held to make more (Bundle 5).
    const plate = stockView(w).find((s) => s.good === 'clothes')!.clothes!;
    expect(plate.slots.map((x) => x.name)).toEqual(['everyday', 'outer']);
    expect(plate.making).toMatch(/^\d+ wool cloth, \d+ linen, \d+ leather, \d+ cured hides/);
  });

  it('shows the clothes worn and each live memory with the days left', () => {
    const w = createWorld(sim, 'ledger');
    step(w, sim, 1);
    const [first, second] = walkersOf(w);
    expect(first!.wearing!.map((r) => r.slot)).toEqual(['Everyday', 'Outer']);
    expect(first!.wearing![1]).toMatchObject({ text: 'Wool cloak, plain' });
    expect(first!.wearing![1]!.detail).toMatch(/^came with them · worn \d+% · warms 4° outdoors$/);
    expect(first!.wearing![0]!.detail).toMatch(/warms 2°$/);
    expect(first!.memories).toEqual([]);
    // Every memory content lists, given straight: the first one earned comes about day 85 on every
    // test seed, too long a run for a view test (it timed out on CI).
    const ctx = { world: w, content } as unknown as SystemContext;
    for (const m of content.memories) addMemory(ctx, first!.id, m.id, w.begunEvent, second!.id);
    step(w, sim, DAY);
    const seen = walkersOf(w).find((p) => p.id === first!.id)!.memories;
    const name = w.entities['person']!.find((q) => q.id === second!.id)!['name'] as string;
    expect(seen).toHaveLength(content.memories.length);
    for (const m of seen) {
      const def = content.memories.find((d) => d.text.replace('{about}', name) === m.text)!;
      expect(def).toBeDefined();
      expect(m.days).toBeGreaterThanOrEqual(1);
      expect(m.days).toBeLessThanOrEqual(def.decayDays);
      expect(m.text).not.toContain('{');
    }
  });
});
