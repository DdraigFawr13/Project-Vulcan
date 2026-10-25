// P5.9, P5.14 done-when: every newcomer's arrival line links to the event that sent them, and a
// colony with newcomers ends with each household in its own home, the first house the hall. The
// band's word stands when it agrees; a split goes by the Strangers law, which everyone answers.
// The content is tuned so this happens in weeks, not a year: homes wanted at once, the first
// stranger on 14 Thawmonth, always a couple, the band's leaning set by `weigh`.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, step, submitCommand, whyOf } from '../index.ts';
import { hallOf, homeFor, householdOf, sleepsIn } from '../build/index.ts';
import { memoriesOf } from '../needs/index.ts';

const DAY = 1440;
const SEED = 'anvil/1';
const s = content.strangers;
const tuned = (weigh: Partial<typeof s.weigh>) => ({
  ...content,
  strangers: {
    ...s,
    home: { ...s.home, after: 0 },
    couple: 100,
    draw: { ...s.draw, first: { month: 'Thawmonth', day: 14 } },
    weigh: { ...s.weigh, ...weigh },
  },
});
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const people = (w: World, status: string) =>
  (w.entities['person'] ?? []).filter((p) => p['status'] === status);

describe('strangers and homes', () => {
  it('a welcome couple stays with a reason cited, and every household ends in its own home', () => {
    const c = tuned({ start: 20 });
    const sim = createSim(c);
    const w = createWorld(sim, SEED);
    step(w, sim, 20 * DAY);
    const came = lines(w, 'people.strangerCame');
    expect(came.length).toBeGreaterThan(0);
    for (const line of came) {
      const why = whyOf(w, line.id).map((x) => x.event.type);
      expect(why).toContain('people.drawn');
    }
    expect(lines(w, 'people.strangerStays').length).toBe(came.length);
    // Each household sleeps in its own home; the couple shares one; the first house is the hall.
    const alive = people(w, 'alive');
    expect(alive.length).toBe(5 + 2 * came.length);
    for (const p of alive) {
      const home = homeFor(w, p.id);
      expect(home?.['state'], p['name'] as string).toBe('built');
      expect(sleepsIn(w, c, p.id)?.id, p['name'] as string).toBe(home!.id);
    }
    const newcomer = alive.find((p) => p['partner'])!;
    expect(householdOf(w, newcomer.id)).toHaveLength(2);
    expect(homeFor(w, newcomer['partner'] as number)!.id).toBe(homeFor(w, newcomer.id)!.id);
    expect(hallOf(w)).toBeDefined();
    const hall = lines(w, 'build.hall')[0]!;
    expect(whyOf(w, hall.id).map((x) => x.event.type)).toContain('people.movedHome');
    const wants = new Set(lines(w, 'people.wantsHome').map((e) => e.id));
    for (const sited of lines(w, 'build.homeSited'))
      expect(sited.causes.some((id) => wants.has(id))).toBe(true);
  });

  it('a band that agrees turns a stranger away whatever the law, and they walk off', () => {
    const c = tuned({ start: -20 });
    const sim = createSim(c);
    const w = createWorld(sim, SEED);
    submitCommand(w, { tick: w.tick, kind: 'setLaw', data: { law: 'strangers', setting: 'open' } });
    step(w, sim, 18 * DAY);
    expect(lines(w, 'people.strangerTurnedAway').length).toBeGreaterThan(0);
    expect(lines(w, 'people.strangerStays')).toHaveLength(0);
    // The law did not come into it: nobody answered it.
    expect((w.entities['answer'] ?? []).filter((a) => a['law'] === 'strangers')).toHaveLength(0);
    expect(people(w, 'stranger').filter((p) => (p['waits'] as number) >= 0)).toHaveLength(0);
    expect(people(w, 'gone').length).toBeGreaterThan(0);
  });

  it('a split band is settled by the law, which each answers; who spoke for one turned away remembers it', () => {
    for (const setting of ['closed', 'open']) {
      const c = tuned({ start: 0, same: 40, other: -40, kinFirst: 0 });
      const sim = createSim(c);
      const w = createWorld(sim, SEED);
      submitCommand(w, { tick: w.tick, kind: 'setLaw', data: { law: 'strangers', setting } });
      // Walk on until the stranger waits at the green, then make one of the band their kin.
      let lead: (typeof w.entities)['person'][number] | undefined;
      for (let d = 0; d < 20 * 24 && !lead; d += 1) {
        step(w, sim, 60);
        lead = people(w, 'stranger').find((p) => (p['waits'] as number) > 0);
      }
      expect(lead).toBeDefined();
      const band = people(w, 'alive');
      const other = c.cultures.find((x) => x.id !== lead!['culture'])!.id;
      band.forEach((p, k) => (p['culture'] = k === 0 ? (lead!['culture'] as string) : other));
      step(w, sim, DAY);
      const answers = (w.entities['answer'] ?? []).filter((a) => a['law'] === 'strangers');
      expect(answers).toHaveLength(band.length);
      if (setting === 'closed') {
        const away = lines(w, 'people.strangerTurnedAway')[0]!;
        expect(away.data['why']).toContain('Closed');
        const kept = memoriesOf(w, band[0]!.id).map((m) => m['memory']);
        expect(kept).toContain(s.memories.turned);
      } else {
        expect(lines(w, 'people.strangerStays')[0]!.data['why']).toContain('Open door');
      }
    }
  });
});
