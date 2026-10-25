// P2.9: with no order to anyone, the band forages when the colony has less food than its stock
// level asks, the berries reach the store, nobody goes hungry in the first month, bushes only bear
// in the warm months and not twice within the regrowing days, and yesterday's tally matches the
// day's lines.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { removeEntity } from '../entity/index.ts';
import { itemsOf, stockOf, storeOf } from '../goods/index.ts';
import { ripe } from './forage.ts';
import { allLines, createSim, createWorld, step, yesterdayOf } from '../index.ts';

const sim = createSim(content);
const DAY = 1440;
const SEEDS = ['ledger/1', 'anvil/2', 'tallow/3'];
type World = ReturnType<typeof createWorld>;
const berriesStored = (w: World): number =>
  itemsOf(w)
    .filter((i) => i['kind'] === 'berries' && !i['holder'])
    .filter((i) => storeOf(w).some((s) => s['x'] === i['x'] && s['y'] === i['y']))
    .reduce((n, i) => n + (i['count'] as number), 0);
/** The cart's rations cut to two stacks (under the food level of 200) so the colony is short. */
function shortOfFood(w: World): World {
  for (const i of itemsOf(w)
    .filter((x) => x['kind'] === 'preserved')
    .slice(2))
    removeEntity(w, 'item', i.id);
  return w;
}
const foraging = (w: World) =>
  allLines(w).filter((e) => e.type === 'work.tookUp' && e.data['work'] === 'foraging');
const gathering = (w: World) =>
  allLines(w).filter((e) => e.type === 'work.tookUpHunting' || e.type === 'work.tookUpFishing');

describe('foraging', () => {
  for (const seed of SEEDS) {
    it(`goes after food within a day when the cart is low on ${seed}`, () => {
      const world = shortOfFood(createWorld(sim, seed));
      step(world, sim, DAY);
      expect(world.commandLog).toHaveLength(0);
      // Hunting and fishing come before foraging (P5.4a); any of the three answers the plate.
      const first = [...foraging(world), ...gathering(world)].sort((a, b) => a.id - b.id)[0]!;
      expect(first.data['good']).toBe('food');
      expect(allLines(world).find((e) => e.id === first.causes[0])?.type).toBe('goods.stockSet');
    });

    it(`stocks berries unordered and keeps the band fed to day 35 on ${seed}`, () => {
      const world = createWorld(sim, seed);
      let stored = 0;
      for (let day = 1; day <= 35; day += 1) {
        step(world, sim, DAY);
        stored = Math.max(stored, berriesStored(world));
      }
      expect(world.commandLog).toHaveLength(0);
      expect(foraging(world)).not.toEqual([]);
      expect(stored).toBeGreaterThan(0);
      const hungry = allLines(world).filter(
        (e) => e.type === 'need.low' && e.data['word'] === 'hungry',
      );
      expect(hungry).toEqual([]);
    });
  }

  it('picks nothing in the cold months and not a bush twice within its regrowing days', () => {
    const cold = content.calendar.monthNames.indexOf('Mistmonth');
    const world = createWorld(sim, 'ledger/1');
    for (const i of itemsOf(world).filter((x) => x['kind'] === 'preserved'))
      removeEntity(world, 'item', i.id);
    world.tick = cold * content.calendar.daysPerMonth * DAY + 6 * 60;
    step(world, sim, 6 * DAY);
    expect(allLines(world).filter((e) => e.type === 'work.picked')).toEqual([]);
    expect(foraging(world)).toEqual([]);

    const warm = shortOfFood(createWorld(sim, 'ledger/1'));
    step(warm, sim, 40 * DAY);
    const picked = allLines(warm).filter((e) => e.type === 'work.picked');
    expect(picked.length).toBeGreaterThan(0);
    // A bush picked is ripe again exactly `regrowDays` later, if it is still the warm months.
    const row = (warm.entities['bush'] ?? [])[0]!;
    const [x, y] = [row['x'] as number, row['y'] as number];
    warm.tick = (row['picked'] as number) + 28 * DAY - 1;
    expect(ripe(warm, content, x, y)).toBe(false);
    warm.tick += 1;
    expect(ripe(warm, content, x, y)).toBe(true);
    const last = new Map<string, number>();
    for (const e of picked) {
      const key = `${e.data['x']},${e.data['y']}`;
      const before = last.get(key);
      if (before !== undefined) expect(e.tick - before).toBeGreaterThanOrEqual(28 * DAY);
      last.set(key, e.tick);
    }
  });

  it('gathers herbs in a herb month while the plate is unmet, and they reach the store', () => {
    const world = createWorld(sim, 'ledger/1');
    // Food is not wanted, so the foragers turn to the herbs plate (some: 12), which is empty.
    stockOf(world, 'food')!['level'] = 'none';
    const month = content.calendar.monthNames.indexOf('Highsun');
    world.tick = month * content.calendar.daysPerMonth * DAY + 6 * 60;
    step(world, sim, 6 * DAY);
    const took = allLines(world).filter((e) => e.type === 'work.tookUpHerbs');
    expect(took.length).toBeGreaterThan(0);
    expect(took[0]!.data['good']).toBe('herbs');
    expect(
      allLines(world).some((e) => e.type === 'work.picked' && e.data['what'] === 'herbs'),
    ).toBe(true);
    const stored = itemsOf(world)
      .filter((i) => i['kind'] === 'herbs' && !i['holder'])
      .filter((i) => storeOf(world).some((s) => s['x'] === i['x'] && s['y'] === i['y']));
    expect(stored.reduce((n, i) => n + (i['count'] as number), 0)).toBeGreaterThan(0);
  });

  it("counts yesterday's work the way the day's lines do", () => {
    let picked = 0;
    for (const seed of SEEDS) {
      const world = shortOfFood(createWorld(sim, seed));
      expect(yesterdayOf(world, content)).toBeUndefined();
      step(world, sim, 3 * DAY);
      const y = yesterdayOf(world, content)!;
      expect([y.day, y.month]).toEqual([3, 'Thawmonth']);
      // The tally counts logs: stone broken up for the house is not felled.
      const onDay = (type: string) =>
        allLines(world)
          .filter((e) => e.type === type && e.tick >= 2 * DAY && e.tick < 3 * DAY)
          .filter((e) => e.data['verb'] !== 'broke up')
          .reduce((n, e) => n + (e.data['count'] as number), 0);
      expect(y.felled).toBe(onDay('work.felled'));
      expect(y.picked).toBe(onDay('work.picked'));
      picked += y.picked;
    }
    expect(picked).toBeGreaterThan(0);
  });
});
