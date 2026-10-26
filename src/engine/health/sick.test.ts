// P5.7 sickness: an illness lays someone abed, runs its course and passes, or turns grave and
// kills; a cold day brings the chill; a sick person gives it to whoever shares the room.
import { describe, expect, it } from 'vitest';
import { content as game, type Content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  whyOf,
  type WorldState,
} from '../index.ts';
import { withoutAccidents } from './index.ts';
import { bodyOf, boutOf } from './index.ts';
import { dyingChance, illsOf } from './sick.ts';

const DAY = 1440;
const h = game.health;
const calm = withoutAccidents(game);
const ills = (over: Record<string, object>) =>
  h.ills.map((d) => (over[d.id] ? { ...d, ...over[d.id] } : d));
const lines = (world: WorldState, type: string) => allLines(world).filter((e) => e.type === type);
const send = (world: WorldState, kind: string, data: Record<string, string | number>) =>
  submitCommand(world, { tick: world.tick + 1, kind, data });

describe('sickness', () => {
  it('lays them abed with the flux, and it passes within its days', () => {
    const sim = createSim(calm);
    const world = createWorld(sim, 'smoke');
    step(world, sim, 3 * DAY);
    const p = world.entities['person']![0]!;
    send(world, 'sicken', { person: p.id, ill: 'flux' });
    step(world, sim, 2 * 60);
    const shown = lines(world, 'health.sick').find((e) => e.actors[0] === p.id)!;
    expect(shown.data['a']).toBe('the flux');
    expect(bodyOf(world, p.id)?.['down']).toBe(1);
    expect(p['doing']).toBe('hurt');
    step(world, sim, 9 * DAY);
    const passed = lines(world, 'health.passed').find((e) => e.actors[0] === p.id)!;
    expect(passed.causes).toContain(shown.id);
    expect(boutOf(world, p.id)).toBeUndefined();
    expect(bodyOf(world, p.id)?.['down']).toBe(0);
    // Immune for its days: a second bout is refused.
    send(world, 'sicken', { person: p.id, ill: 'flux' });
    step(world, sim, 60);
    expect(lines(world, 'command.refused').at(-1)?.data['kind']).toBe('sicken');
  });

  it('kills a grave case untended, naming the grave illness; a healer cuts the chance', () => {
    const deadly: Content = {
      ...calm,
      health: { ...h, ills: ills({ chill: { grave: 100, dies: 100 } }) },
    };
    const sim = createSim(deadly);
    const world = createWorld(sim, 'anvil');
    step(world, sim, 2 * DAY);
    const p = world.entities['person']![1]!;
    send(world, 'sicken', { person: p.id, ill: 'chill' });
    step(world, sim, 11 * DAY);
    const turned = lines(world, 'health.grave').find((e) => e.actors[0] === p.id)!;
    expect(turned.data['grave']).toBe('lung fever');
    const died = lines(world, 'health.died').find((e) => e.actors[0] === p.id)!;
    expect(String(died.data['cause'])).toMatch(/^Lung fever took/);
    expect(whyOf(world, died.id).some((c) => c.event.id === turned.id)).toBe(true);
    const def = deadly.health.ills.find((d) => d.id === 'chill')!;
    expect(dyingChance(def, { id: 0, cut: 48 })).toBe(52);
  });

  it('brings the chill on a day cold through, and gives it to whoever shares the room', () => {
    const cold: Content = {
      ...calm,
      life: { ...calm.life, warmth: { ...calm.life.warmth, comfort: 60, perDegree: 5000 } },
      health: {
        ...h,
        sick: { ...h.sick, coldHours: 1 },
        ills: ills({ chill: { catch: 1000, spread: 1000, days: [6, 6] } }),
      },
    };
    const sim = createSim(cold);
    const world = createWorld(sim, 'tallow');
    step(world, sim, 2 * DAY);
    const caught = lines(world, 'health.sick');
    expect(caught.length).toBeGreaterThan(0);
    expect(String(caught[0]!.data['how'])).toMatch(/cold through/);
    // Everyone is soon down with it, so nobody is left to catch it from a roommate here.
    expect(illsOf(world).filter((r) => r['ill'] === 'chill').length).toBe(
      world.entities['person']!.length,
    );
  });
});
