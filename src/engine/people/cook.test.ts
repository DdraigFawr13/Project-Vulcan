// V-090, V-091: with a lit fire and no order to anyone, a cook turns raw food and firewood into
// meals beside the hearth, haulers bring them in, and the band eats them on most days, each meal
// leaving an `ate-well` memory that raises the mood. Cooking is a normal Work row: the player's
// priority for it moves who takes it up.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, memoriesOf, needOf, step, whyOf } from '../index.ts';
import { submitCommand } from '../index.ts';

// Every month at -12 degrees: the campfire is built and lit early and stays lit.
const winter = {
  ...content,
  seasons: { ...content.seasons, months: content.seasons.months.map(() => -12) },
};
const sim = createSim(winter);
const DAY = 1440;
const SEEDS = ['ledger', 'tallow'];
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** The needs' weighted mean, without memories. */
function needsMean(w: World, person: number): number {
  let [sum, weights] = [0, 0];
  for (const def of content.life.needs) {
    sum += (needOf(w, person, def.id)!['value'] as number) * def.weight;
    weights += def.weight;
  }
  return Math.floor(sum / weights);
}

describe('cooking', () => {
  for (const seed of SEEDS) {
    it(`feeds the band cooked meals on most days of a week, unordered, on ${seed}`, () => {
      const w = createWorld(sim, seed);
      step(w, sim, 7 * DAY);
      // The week of cooking: days 7 to 14.
      const eatingDays = new Set<number>();
      let raised = 0;
      let sampled = 0;
      for (let h = 0; h < 7 * 24; h += 1) {
        step(w, sim, 60);
        const day = Math.floor(w.tick / DAY);
        for (const p of people(w)) {
          const well = memoriesOf(w, p.id).filter((m) => m['memory'] === 'ate-well');
          if (well.length) eatingDays.add(day);
          // A memory more than an hour old is in the hour's mood.
          const made = well.find((m) => (m['until'] as number) - 2 * DAY <= w.tick - 60);
          const mood =
            needOf(w, p.id, 'food') && (w.entities['mood'] ?? []).find((m) => m['person'] === p.id);
          if (made && mood && (mood['value'] as number) < content.life.scale) {
            sampled += 1;
            if ((mood['value'] as number) > needsMean(w, p.id)) raised += 1;
          }
        }
      }
      expect(w.commandLog).toHaveLength(0);
      expect(eatingDays.size).toBeGreaterThanOrEqual(5);
      expect(sampled).toBeGreaterThan(0);
      expect(raised).toBe(sampled);
      // The last batch traces to the cook taking it up, which cites the lit fire's last line.
      const cooked = lines(w, 'food.cooked');
      expect(cooked.length).toBeGreaterThan(0);
      const chain = whyOf(w, cooked.at(-1)!.id).map((c) => c.event.type);
      expect(chain[0]).toBe('work.tookUpCooking');
      // ...the fire's last line (lit, banked or tended).
      expect(chain[1]).toMatch(/^(fire\.|work\.tookUpTending)/);
    });
  }

  it('is a Work row the player can raise: priority moves who cooks, citing the lever', () => {
    const w = createWorld(sim, 'ledger');
    const cook = people(w)[2]!;
    submitCommand(w, {
      tick: 1,
      kind: 'setPriority',
      data: { person: cook.id, job: 'cook', level: 1 },
    });
    step(w, sim, 10 * DAY);
    expect(lines(w, 'command.refused')).toEqual([]);
    const by = lines(w, 'work.tookUpCooking').filter((e) => e.actors.includes(cook.id));
    expect(by.length).toBeGreaterThan(0);
    expect(
      by.some((e) =>
        e.causes.some((c) => allLines(w).find((l) => l.id === c)?.type === 'work.prioritySet'),
      ),
    ).toBe(true);
  });

  it('does nothing with no lit fire: the band eats raw', () => {
    const warm = createSim({
      ...content,
      seasons: { ...content.seasons, months: content.seasons.months.map(() => 25) },
    });
    const w = createWorld(warm, 'ledger');
    step(w, warm, 3 * DAY);
    expect(lines(w, 'food.cooked')).toEqual([]);
    expect(lines(w, 'work.tookUpCooking')).toEqual([]);
  });
});
