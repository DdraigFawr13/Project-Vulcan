// P5.5, V-134: clothes wear with use (everyday clothes while awake, the outer layer outdoors and
// faster in the cold), and someone whose clothes wear thin changes into a spare from the store.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, step } from '../index.ts';
import { itemsAt, itemsOf, layItem, storeOf, wornIn } from '../goods/index.ts';

const SEED = 'anvil/2';
const people = (w: ReturnType<typeof createWorld>) => w.entities['person'] ?? [];
const lifeOf = (kind: string) => content.clothes.garments.find((g) => g.item === kind)!.last;

describe('clothes', () => {
  it('wear with use: everyday clothes while awake, the outer layer more in the cold', () => {
    const sim = createSim(content);
    const w = createWorld(sim, SEED);
    step(w, sim, 3 * 1440);
    const p = people(w)[0]!;
    const tunic = wornIn(w, content, p.id, 'everyday')!;
    const cloak = wornIn(w, content, p.id, 'outer')!;
    const used = (i: typeof tunic) => lifeOf(i['kind'] as string) - (i['wear'] as number);
    // Three days awake about two-thirds of each: 40 to 60 hours of wear on the tunic.
    expect(used(tunic)).toBeGreaterThan(40);
    expect(used(tunic)).toBeLessThan(60);
    // The cloak only outdoors.
    expect(used(cloak)).toBeGreaterThan(0);
    expect(used(cloak)).toBeLessThanOrEqual(3 * 24 * content.clothes.cold);
  });

  it('change into a spare from the store when worn thin, with one line', () => {
    const sim = createSim(content);
    const w = createWorld(sim, SEED);
    const p = people(w)[0]!;
    wornIn(w, content, p.id, 'everyday')!['wear'] = 2;
    const tile = storeOf(w).find((s) => !itemsAt(w, s['x'] as number, s['y'] as number, 0).length)!;
    const at = { x: tile['x'] as number, y: tile['y'] as number, z: 0, made: 0 };
    layItem(w, { kind: 'smock', count: 1, ...at }, { quality: 'fine', wear: 4000 });
    step(w, sim, 1440);
    const now = wornIn(w, content, p.id, 'everyday')!;
    expect(now['kind']).toBe('smock');
    expect(itemsOf(w).filter((i) => i['kind'] === 'smock')).toHaveLength(1);
    const line = allLines(w).find((e) => e.type === 'people.changed')!;
    expect(line.actors).toEqual([p.id]);
    expect(line.data['why']).toMatch(/wool tunic was worn thin|worn through/);
  });
});
