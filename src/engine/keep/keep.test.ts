// P5.12, V-132: food spoils by where it lies and how warm it is; whole units go, the rest carries
// over; each store's loss is one line a week naming what spoiled, citing the store.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { addEntity } from '../entity/index.ts';
import { layItem } from '../goods/index.ts';
import { allLines, createSim, createWorld, itemsOf } from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { floorsOf, keepSystem, placeOf, rateOf } from './index.ts';

const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;

/** A fresh world with the cart's food taken away, and a built larder 6 tiles east of the start. */
function bare(): { w: World; larder: number } {
  const w = createWorld(sim, 'anvil');
  for (const i of [...itemsOf(w)])
    if (content.life.eat[i['kind'] as string] !== undefined) i['count'] = 0;
  w.entities['item'] = itemsOf(w).filter((i) => (i['count'] as number) > 0);
  const { startX: x, startY: y } = w.map;
  const larder = addEntity(w, 'depot', {
    ...{ store: 'larder', x: x + 6, y, z: 0, w: 5, h: 4, state: 'built', line: 1, built: 1 },
    builtTick: 1,
  });
  return { w, larder };
}

const lay = (w: World, kind: string, count: number, x: number, y: number, z = 0) => {
  const id = layItem(w, { kind, count, x, y, z, made: 1 });
  return itemsOf(w).find((i) => i.id === id)!;
};

describe('keeping food', () => {
  it('spoils faster in the open than in a walled store, slower below ground and in frost', () => {
    const { w } = bare();
    const { startX: x, startY: y } = w.map;
    const floors = floorsOf(w, content);
    const open = lay(w, 'turnips', 50, x - 8, y);
    const kept = lay(w, 'turnips', 50, x + 7, y + 1);
    const below = lay(w, 'turnips', 50, x + 7, y + 1, 1);
    expect(placeOf(w, open, floors)).toBe('open');
    expect(placeOf(w, kept, floors)).toBe('walled');
    expect(placeOf(w, below, floors)).toBe('below');
    w.systems['weather']!['temp'] = 15;
    const [o, k, b] = [open, kept, below].map((i) => rateOf(w, content, i, floors));
    expect(o).toBeGreaterThan(k!);
    expect(k).toBeGreaterThan(b!);
    w.systems['weather']!['temp'] = -5;
    expect(rateOf(w, content, kept, floors)).toBeLessThan(k!);
    // A cooked meal keeps at its own rate wherever it lies.
    const meal = lay(w, 'stew', 4, x - 9, y);
    expect(rateOf(w, content, meal, floors)).toBe(
      content.items.find((d) => d.id === 'stew')!.spoilPerDay,
    );
  });

  it('takes whole units, carries the rest, and says each store loss once a week', () => {
    const { w, larder } = bare();
    const { startX: x, startY: y } = w.map;
    const fish = lay(w, 'fish', 40, x + 7, y + 1);
    const berries = lay(w, 'berries', 40, x - 8, y);
    // Seven midnights of the keeping system alone (nobody carries the food meanwhile).
    const ctx = contextFor(w, sim, keepSystem);
    w.systems['weather']!['temp'] = 15;
    for (let d = 1; d <= 7; d += 1) {
      w.tick = d * DAY;
      keepSystem.run!(ctx);
    }
    expect(fish['count']).toBeLessThan(40);
    expect(berries['count']).toBeLessThan(fish['count'] as number);
    expect(fish['rot']).toBeLessThan(1_000_000);
    const stored = allLines(w).filter(
      (e) => e.type === 'keep.spoiled' && e.data['store'] === larder,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.data['count']).toBe(40 - (fish['count'] as number));
    expect(stored[0]!.data['what']).toMatch(/fish/);
    expect(stored[0]!.causes).toEqual([1]);
    const open = allLines(w).filter((e) => e.type === 'keep.spoiledOpen');
    expect(open.some((e) => /berries/.test(e.data['what'] as string))).toBe(true);
  });
});
