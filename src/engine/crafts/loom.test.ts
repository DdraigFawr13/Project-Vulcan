// P5.5, V-134, V-041: with fleece in store and the Clothes plate short, and no order to anyone, a
// carpenter makes a loom, a weaver weaves the fleece into wool and a tailor makes a garment of it.
// Flax takes a field's beans course in spring while the everyday clothes wanted are short and food
// is at its plate.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, step } from '../index.ts';
import { cropNow, fieldsOf } from '../build/fields.ts';
import { removeEntity } from '../entity/index.ts';
import { itemsAt, itemsOf, layItem, storeOf } from '../goods/index.ts';

const DAY = 1440;
const sim = createSim(content);
// The cart's wool cloth would cover the plate: set aside, so the colony needs the loom.
const noWool = (w: ReturnType<typeof createWorld>) => {
  for (const i of itemsOf(w).filter((i) => i['kind'] === 'wool')) removeEntity(w, 'item', i.id);
};
const lines = (w: ReturnType<typeof createWorld>, type: string) =>
  allLines(w).filter((e) => e.type === type);

describe('the loom', () => {
  it('makes a loom, weaves fleece and makes clothes of it, unordered', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 4 * DAY);
    noWool(w);
    const tile = storeOf(w).find((s) => !itemsAt(w, s['x'] as number, s['y'] as number, 0).length)!;
    layItem(w, {
      kind: 'fleece',
      count: 3,
      x: tile['x'] as number,
      y: tile['y'] as number,
      z: 0,
      made: 0,
    });
    step(w, sim, 20 * DAY);
    expect(w.commandLog).toHaveLength(0);
    const took = lines(w, 'work.tookUpCarpentry').find((e) => e.data['kind'] === 'loom');
    expect(took?.data['why']).toBe('3 fleece wait to be woven');
    const wove = lines(w, 'loom.wove');
    expect(wove.length).toBeGreaterThan(0);
    expect(wove[0]!.data['what']).toBe('wool cloth');
    const made = lines(w, 'clothes.made');
    expect(made.length).toBeGreaterThan(0);
    // The tailor's line cites the taking up, which cites the plate's want.
    const up = lines(w, 'work.tookUpTailoring')[0]!;
    expect(made[0]!.causes).toContain(up.id);
    expect(up.data['why']).toMatch(/clothes are short/);
  });

  it('sows flax for a beans course in spring while clothes are short, else beans', () => {
    const w = createWorld(sim, 'ledger');
    step(w, sim, DAY);
    noWool(w);
    const f = fieldsOf(w)[0]!;
    const beans = content.buildings.field.rotation.indexOf('beans');
    const seedmonth = content.calendar.monthNames.indexOf('Seedmonth');
    w.tick = seedmonth * 28 * DAY + 400 * 28 * 12 * DAY;
    Object.assign(f, { course: beans, crop: '', done: [], state: 'fallow' });
    for (const i of f['tiles'] as number[]) w.map.fertility[i] = 60;
    expect(cropNow(w, content, f)?.id).toBe('flax');
    // A band under its food plate sows to eat (the 5B review: anvil's only field went to flax).
    const hungry = structuredClone(w);
    const food = new Set(content.items.filter((i) => i.good === 'food').map((i) => i.id));
    for (const i of itemsOf(hungry).filter((i) => food.has(i['kind'] as string)))
      removeEntity(hungry, 'item', i.id);
    expect(cropNow(hungry, content, fieldsOf(hungry)[0]!)?.id).toBe('beans');
    const stock = w.entities['stock']!.find((s) => s['good'] === 'clothes')!;
    stock['level'] = 'none';
    expect(cropNow(w, content, f)?.id).toBe('beans');
  });
});
