// P2.7 done-when: skipping a quiet stretch stops on each notable line in turn, and the ledger it
// writes is the one a run at any speed writes to the same tick, levers included. P2.6: hunger
// after the food runs out cites the line where the last of it was eaten.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  toNdjson,
  whyOf,
} from '../index.ts';
import { removeEntity } from '../entity/index.ts';
import { itemsOf } from '../goods/index.ts';

const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
/** The cart's rations cut to two stacks, so the food runs out in days rather than weeks (the
 * 5A review: the full cart ran this test near its 15 s limit). */
function shortOfFood(w: World): World {
  for (const i of itemsOf(w)
    .filter((x) => x['kind'] === 'preserved')
    .slice(2))
    removeEntity(w, 'item', i.id);
  return w;
}

describe('skip ahead', () => {
  it('stops on each notable line, with the ledger of an unskipped run', () => {
    const skipped = shortOfFood(createWorld(sim, 'ledger'));
    const start = skipped.tick;
    const lever = {
      tick: skipped.tick + 2 * DAY,
      kind: 'setStock',
      data: { good: 'logs', level: 'plenty' },
    };
    // No food wanted: nobody forages, so the cart's food runs out before the first harvest.
    const fast = { tick: lever.tick, kind: 'setStock', data: { good: 'food', level: 'none' } };
    submitCommand(skipped, lever);
    submitCommand(skipped, fast);
    // A quiet month: the first notable line is the colony siting its house; skipping on from
    // each stop reaches the band eating the last of the cart's food.
    const stops: string[] = [];
    let from = start;
    while (stops.at(-1) !== 'goods.foodGone' && skipped.tick < start + 90 * DAY) {
      step(skipped, sim, 90 * DAY, sim.notable);
      const stop = skipped.log.at(-1)!;
      expect(stop.tick).toBe(skipped.tick);
      stops.push(skipped.log.filter((e) => e.tick === skipped.tick).find(sim.notable)!.type);
      // Nothing notable was passed over on the way.
      expect(
        allLines(skipped)
          .filter((e) => e.tick > from && e.tick < skipped.tick)
          .filter(sim.notable),
      ).toEqual([]);
      from = skipped.tick;
    }
    expect(stops[0]).toBe('build.sited');
    expect(stops.at(-1)).toBe('goods.foodGone');

    const run = shortOfFood(createWorld(sim, 'ledger'));
    submitCommand(run, lever);
    submitCommand(run, fast);
    while (run.tick < skipped.tick) step(run, sim, Math.min(100, skipped.tick - run.tick));
    expect(toNdjson(allLines(run))).toBe(toNdjson(allLines(skipped)));

    // Hunger that follows is caused by the food running out, not by the band's arrival.
    const hunger = (e: (typeof skipped.log)[number]) =>
      e.type === 'need.low' && e.data['need'] === 'food';
    step(skipped, sim, 2 * DAY, hunger);
    const hungry = skipped.log.findLast(hunger)!;
    expect(hungry).toBeDefined();
    expect(whyOf(skipped, hungry.id)[0]?.event.type).toBe('goods.foodGone');
  });
});
