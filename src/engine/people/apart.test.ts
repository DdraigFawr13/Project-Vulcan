// P6.5, V-144: the Sickness law's settings at work. Sent away, someone sick with a catching
// illness leaves the valley and comes back over it; kin who refuse the law keep them at home; under
// the sick-house setting the builders site one away from the homes for them.
import { describe, expect, it } from 'vitest';
import { content as game, type Content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  type WorldState,
} from '../index.ts';
import { homeHouse, withoutAccidents } from '../health/index.ts';

const DAY = 1440;
const calm = withoutAccidents(game);
// The flux here never turns grave, so whoever is sent away comes back.
const mild: Content = {
  ...calm,
  health: {
    ...calm.health,
    ills: calm.health.ills.map((d) => (d.id === 'flux' ? { ...d, grave: 0 } : d)),
  },
};
const lines = (w: WorldState, type: string) => allLines(w).filter((e) => e.type === type);
const send = (w: WorldState, kind: string, data: Record<string, string | number>) =>
  submitCommand(w, { tick: w.tick + 1, kind, data });
const alive = (w: WorldState) =>
  (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Sets the Sickness law and fixes everyone's answer: obeys, but `refuser` refuses. */
function setSickness(w: WorldState, sim: ReturnType<typeof createSim>, s: string, refuser = 0) {
  send(w, 'setLaw', { law: 'sickness', setting: s });
  step(w, sim, 2);
  for (const a of w.entities['answer'] ?? [])
    if (a['law'] === 'sickness')
      Object.assign(a, { answer: a['person'] === refuser ? 'refuses' : 'obeys', at: w.tick });
}

describe('the Sickness law', () => {
  it('sends the catching-sick away, and they come back over it', () => {
    const sim = createSim(mild);
    const w = createWorld(sim, 'anvil');
    step(w, sim, 3 * DAY);
    setSickness(w, sim, 'away');
    const p = alive(w)[0]!;
    send(w, 'sicken', { person: p.id, ill: 'flux' });
    // The flux shows a day after it is caught.
    step(w, sim, DAY + 2 * 60);
    expect(p['status']).toBe('away');
    const sick = lines(w, 'health.sick').find((e) => e.actors[0] === p.id)!;
    const sent = lines(w, 'people.sentAway').find((e) => e.actors[0] === p.id)!;
    expect(sent.causes).toContain(sick.id);
    expect(sent.causes).toContain(lines(w, 'law.set').at(-1)!.id);
    // Nobody nurses them out there.
    for (let d = 0; d < 10 && p['status'] === 'away'; d += 1) step(w, sim, DAY);
    expect(lines(w, 'health.draught').some((e) => e.actors[1] === p.id)).toBe(false);
    expect(p['status']).toBe('alive');
    const back = lines(w, 'people.cameBack').find((e) => e.actors[0] === p.id)!;
    expect(back.causes).toContain(sent.id);
  });

  it('is refused by kin, who keep them at home with a line', () => {
    const sim = createSim(mild);
    const w = createWorld(sim, 'anvil');
    // Until two of them sleep under one roof.
    const pair = () => {
      const band = alive(w).map((x) => [x, homeHouse(w, mild, x)] as const);
      const a = band.find(([x, h]) => h && band.some(([y, g]) => y !== x && g === h));
      return a && [a[0], band.find(([y, g]) => y !== a[0] && g === a[1])![0]];
    };
    for (let d = 0; d < 30 && !pair(); d += 1) step(w, sim, DAY);
    const [p, q] = pair()!;
    setSickness(w, sim, 'away', q!.id);
    send(w, 'sicken', { person: p!.id, ill: 'flux' });
    // The flux shows a day after it is caught.
    step(w, sim, DAY + 2 * 60);
    expect(p!['status']).toBe('alive');
    const kept = lines(w, 'people.keptHome').find((e) => e.actors[0] === p!.id)!;
    expect(kept.actors).toContain(q!.id);
    const answer = (w.entities['answer'] ?? []).find(
      (a) => a['person'] === q!.id && a['law'] === 'sickness',
    )!;
    expect(kept.causes).toContain(answer['line']);
  });

  it('has the builders site a sick-house away from the homes', () => {
    const sim = createSim(calm);
    const w = createWorld(sim, 'smoke');
    step(w, sim, 3 * DAY);
    setSickness(w, sim, 'sickhouse');
    const p = alive(w)[0]!;
    send(w, 'sicken', { person: p.id, ill: 'chill' });
    step(w, sim, 3 * 60);
    const sited = lines(w, 'build.sickHouse')[0]!;
    expect(sited.actors).toEqual([p.id]);
    const sent = lines(w, 'people.sentToHouse').find((e) => e.actors[0] === p.id)!;
    expect(sent.causes).toContain(lines(w, 'law.set').at(-1)!.id);
    expect(sited.causes).toContain(sent.id);
    const houses = w.entities['house'] ?? [];
    const sh = houses.find((h) => h['sick'] === 2)!;
    expect(sh['line']).toBe(sited.id);
    // As far from the homes as the ground allows: toward the town ring, not beside a home.
    expect(sited.data['far'] as number).toBeGreaterThan(game.buildings.house.near / 2);
  });
});
