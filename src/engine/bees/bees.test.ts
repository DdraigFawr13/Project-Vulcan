// P5.13, V-135: the skep stand is sited from the need by a standing field, a beekeeper makes the
// skeps, catches a swarm and takes the honey and wax, and every line leads back to the siting. The
// swarm and harvest months are set to the world's first month and a swarm always comes (chance
// 100), so a few days show the whole year. No command is given.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { clockAt } from '../core/index.ts';
import { allLines, createSim, createWorld, itemsOf, skepsOf, step } from '../index.ts';

const lamp = content.lamp;
const spring = {
  ...content,
  lamp: {
    ...lamp,
    bees: {
      ...lamp.bees,
      skep: {
        ...lamp.bees.skep,
        months: [content.calendar.monthNames[clockAt(0, content.calendar).month]!],
      },
      swarm: {
        months: [content.calendar.monthNames[clockAt(0, content.calendar).month]!],
        chance: 100,
      },
      harvest: {
        ...lamp.bees.harvest,
        month: content.calendar.monthNames[clockAt(0, content.calendar).month]!,
      },
    },
  },
};
const sim = createSim(spring);

describe('the skep stand', () => {
  for (const seed of ['smoke', 'tallow']) {
    it(`is sited by the field, made, swarmed and robbed with every line leading back (${seed})`, () => {
      const world = createWorld(sim, seed);
      const lines = () => allLines(world);
      // Run to the minute the first honey is laid (hauling later merges stacks).
      for (let m = 0; m < 8 * 1440 && !skepsOf(world).some((k) => k['harvested']); m += 1)
        step(world, sim, 1);
      const all = lines();
      const of = (type: string) => all.filter((e) => e.type === type);
      const [sited] = of('bees.sited');
      expect(sited).toBeDefined();
      expect(String(sited!.data['why'])).toMatch(
        /^flowers on the field for the bees, and the woods \w+ for swarms$/,
      );
      expect(all.find((e) => e.type === 'field.sited')!.id).toBe(sited!.causes[0]);

      // A stand of `stand` skeps side by side, made one by one, with bees after a swarm.
      const skeps = skepsOf(world);
      expect(skeps).toHaveLength(content.lamp.bees.stand);
      const xs = skeps.map((s) => s['x'] as number);
      const ys = skeps.map((s) => s['y'] as number);
      const spread = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
      expect(spread).toBe(skeps.length - 1);
      const made = skeps.filter((k) => k['state'] !== 'plan').length;
      expect(made).toBeGreaterThan(1);
      expect(of('bees.skep')).toHaveLength(made);
      expect(of('bees.swarm').length).toBeGreaterThan(0);
      const harvest = of('bees.harvest')[0]!;
      expect(harvest.data['honey']).toBe(content.lamp.bees.harvest.honey);
      const laid = (kind: string) =>
        itemsOf(world)
          .filter((i) => i['kind'] === kind && i['made'] === harvest.id)
          .reduce((n, i) => n + (i['count'] as number), 0);
      expect(laid('honey')).toBe(content.lamp.bees.harvest.honey);
      expect(laid('wax')).toBe(content.lamp.bees.harvest.wax);

      // Every beekeeping line traces through its causes to the siting.
      const byId = new Map(all.map((e) => [e.id, e]));
      const leads = (id: number): boolean => {
        for (const c of byId.get(id)?.causes ?? []) if (c === sited!.id || leads(c)) return true;
        return false;
      };
      const mine = all.filter((e) =>
        /^bees\.(skep|swarm|harvest)$|^work\.tookUpBees$/.test(e.type),
      );
      expect(mine.length).toBeGreaterThan(3);
      for (const e of mine) expect(leads(e.id)).toBe(true);
      expect(world.commandLog).toHaveLength(0);
    });
  }
});
