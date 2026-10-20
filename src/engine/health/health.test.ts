// P5.6, P5.8 done-when: a mining injury is carried to bed and treated, and a death is logged
// with its causes and buried. Risk is raised in content so the events come on the first days.
import { describe, expect, it } from 'vitest';
import { content as game, type Content } from '../../content/index.ts';
import {
  createSim,
  createWorld,
  step,
  submitCommand,
  whyOf,
  withoutAccidents,
  type WorldState,
} from '../index.ts';
import { memoriesOf } from '../needs/index.ts';
import { bodyOf, dailyChance, openWounds } from './index.ts';

const DAY = 1440;
const h = game.health;
const only = (id: string) => h.severities.map((s) => ({ ...s, share: s.id === id ? 100 : 0 }));

/** Every minute in a shaft is a fall, and a fall is a deep break to the left leg. */
const falls: Content = {
  ...game,
  health: {
    ...h,
    severities: only('deep'),
    accidents: [
      {
        ...h.accidents.find((a) => a.id === 'shaft-fall')!,
        perHour: 50_000_000,
        parts: ['left-leg'],
      },
    ],
  },
};

/** No accidents; a grave wound always bleeds out. */
const mortal: Content = {
  ...withoutAccidents(game),
  health: {
    ...h,
    accidents: [],
    severities: h.severities.map((s) => (s.id === 'grave' ? { ...s, mortal: 100 } : s)),
  },
};

const send = (world: WorldState, kind: string, data: Record<string, string | number>) =>
  submitCommand(world, { tick: world.tick + 1, kind, data });

const people = (world: WorldState) => world.entities['person']!;
const lines = (world: WorldState, type: string) => world.log.filter((e) => e.type === type);
const traces = (world: WorldState, from: number, to: number) =>
  whyOf(world, from).some((c) => c.event.id === to);

describe('health', () => {
  it('spreads a chance over days without powers: 1 in 4 over 7 days is about 4% a day', () => {
    expect(dailyChance(25, 7)).toBeGreaterThan(40_000);
    expect(dailyChance(25, 7)).toBeLessThan(40_500);
    expect(dailyChance(0, 7)).toBe(0);
  });

  it('carries a miner who fell in the shaft to bed and binds the break, each line back to the fall', () => {
    const sim = createSim(falls);
    const world = createWorld(sim, 'tallow');
    send(world, 'setStock', { good: 'iron-ingot', level: 'some' });
    for (let d = 0; d < 12 && !lines(world, 'health.hurt').length; d += 1) step(world, sim, DAY);
    const hurt = lines(world, 'health.hurt')[0]!;
    expect(hurt, 'a fall within 12 days').toBeDefined();
    expect(hurt.data['what']).toBe('fell in the shaft');
    // The fall cites the miner taking up the shaft.
    expect(world.log.find((e) => e.id === hurt.causes[0])?.type).toMatch(/^work\.tookUp/);
    step(world, sim, DAY / 2);
    const p = people(world).find((q) => q.id === hurt.actors[0])!;
    const carried = lines(world, 'health.carried').find((e) => e.actors[1] === p.id)!;
    const bound = lines(world, 'health.bound').find((e) => e.actors[1] === p.id)!;
    expect(carried).toBeDefined();
    expect(bound).toBeDefined();
    expect(traces(world, carried.id, hurt.id)).toBe(true);
    expect(traces(world, bound.id, hurt.id)).toBe(true);
    // Abed: lying on the bed they were carried to, the break bound by a healer.
    const body = bodyOf(world, p.id)!;
    expect(body['down']).toBe(1);
    expect(body['bed']).toBeGreaterThan(0);
    expect(p['doing']).toBe('hurt');
    expect(openWounds(world, p.id).every((w) => w['bound'] === 2)).toBe(true);
  });

  it('logs a death with its causes, lays out a burial ground and buries the dead with mourners', () => {
    const sim = createSim(mortal);
    const world = createWorld(sim, 'smoke');
    step(world, sim, DAY / 2);
    const p = people(world)[2]!;
    send(world, 'hurt', { person: p.id, part: 'body', severity: 'grave' });
    for (let k = 0; k < 24 && p['status'] === 'alive'; k += 1) step(world, sim, 60);
    const died = lines(world, 'health.died')[0]!;
    expect(died, 'bled out within a day').toBeDefined();
    expect(died.data['cause']).toMatch(/bled to death/);
    const hurt = lines(world, 'health.hurt')[0]!;
    expect(died.causes).toContain(hurt.id);
    // Everyone grieves: the close the most.
    for (const q of people(world).filter((q) => q.id !== p.id))
      expect(memoriesOf(world, q.id).some((m) => m['about'] === p.id)).toBe(true);
    for (let d = 0; d < 4 && p['status'] !== 'buried'; d += 1) step(world, sim, DAY);
    expect(lines(world, 'build.burialSited')).toHaveLength(1);
    const buried = lines(world, 'health.buried')[0]!;
    expect(buried, 'buried within 4 days').toBeDefined();
    expect(p['status']).toBe('buried');
    expect(traces(world, buried.id, died.id)).toBe(true);
    const grave = world.entities['grave']!.find((g) => g['person'] === p.id)!;
    expect([p['x'], p['y']]).toEqual([grave['x'], grave['y']]);
    expect(
      people(world).some((q) =>
        memoriesOf(world, q.id).some((m) => m['memory'] === h.mourn.burial),
      ),
    ).toBe(true);
  });

  it('names the wound they bled to death from even when its binding stopped it that hour', () => {
    const sim = createSim(mortal);
    const world = createWorld(sim, 'smoke');
    step(world, sim, DAY / 2);
    const p = people(world)[1]!;
    send(world, 'hurt', { person: p.id, part: 'left-arm', severity: 'deep' });
    step(world, sim, 1);
    const w = openWounds(world, p.id)[0]!;
    Object.assign(w, { bound: 2, bleed: 1 });
    bodyOf(world, p.id)!['blood'] = 1;
    step(world, sim, 60);
    expect(p['status']).toBe('dead');
    expect(lines(world, 'health.died')[0]!.data['cause']).toMatch(/left arm/);
  });

  it('adds a sickroom to the first cottage once two lie hurt at once', () => {
    const sim = createSim(withoutAccidents(game));
    const world = createWorld(sim, 'tallow');
    const cottage = () => (world.entities['house'] ?? []).find((x) => x['state'] === 'built');
    for (let d = 0; d < 20 && !cottage(); d += 1) step(world, sim, DAY);
    expect(cottage(), 'a cottage within 20 days').toBeDefined();
    const [a, b] = people(world);
    send(world, 'hurt', { person: a!.id, part: 'left-leg', severity: 'deep' });
    send(world, 'hurt', { person: b!.id, part: 'right-leg', severity: 'deep' });
    step(world, sim, 120);
    const sick = lines(world, 'build.sickroom')[0]!;
    expect(sick).toBeDefined();
    expect(sick.actors).toEqual(expect.arrayContaining([a!.id, b!.id]));
    expect((world.entities['house'] ?? []).some((x) => x['sick'] === 1)).toBe(true);
  });
});
