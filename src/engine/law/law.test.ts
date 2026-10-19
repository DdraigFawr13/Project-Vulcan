// P4.8, V-091: the work-hours law is a lever nobody is ordered by. Each person weighs it from
// mood, needs, traits and memories: two people answer the same law differently, each reason
// citing the memories behind it; a refuser keeps the customary hours, and whoever sees it
// remembers it. Customary asks nothing. Temperament and memories move the warmth line (V-046).
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  hoursOf,
  memoriesOf,
  step,
  submitCommand,
  TICKS_PER_DAY,
  warmLineOf,
  whyOf,
} from '../index.ts';

// Two test memories that lean hard on Long days, so the answers do not hang on the band's traits.
const long = content.laws.laws[0]!.settings.find((s) => s.id === 'long')!;
const tilted = {
  ...content,
  laws: {
    ...content.laws,
    laws: [
      {
        ...content.laws.laws[0]!,
        settings: content.laws.laws[0]!.settings.map((s) =>
          s === long ? { ...s, memories: { ...s.memories, vented: -100, worshipped: 100 } } : s,
        ),
      },
    ],
  },
};
const sim = createSim(tilted);
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const answers = (w: World) => w.entities['answer'] ?? [];

/** A world on day 2 at 17:00 where the first person holds `vented` and the rest `worshipped`. */
function band(seed: string): World {
  const w = createWorld(sim, seed);
  step(w, sim, TICKS_PER_DAY + 11 * 60 - (w.tick % TICKS_PER_DAY));
  const cause = w.begunEvent;
  people(w).forEach((p, k) =>
    addEntity(w, 'memory', {
      person: p.id,
      memory: k === 0 ? 'vented' : 'worshipped',
      until: w.tick + 5 * TICKS_PER_DAY,
      line: cause,
      about: 0,
    }),
  );
  submitCommand(w, {
    tick: w.tick + 1,
    kind: 'setLaw',
    data: { law: 'work-hours', setting: 'long' },
  });
  step(w, sim, 2);
  return w;
}

describe('the work-hours law', () => {
  it('is answered differently by two people, each reason citing their memories', () => {
    const w = band('anvil');
    const [first, second] = people(w);
    const a = answers(w).find((r) => r['person'] === first!.id)!;
    const b = answers(w).find((r) => r['person'] === second!.id)!;
    expect(a['answer']).toBe('refuses');
    expect(b['answer']).toBe('obeys');
    for (const [row, p] of [
      [a, first!],
      [b, second!],
    ] as const) {
      const memory = memoriesOf(w, p.id).find((m) =>
        (row['cites'] as number[]).includes(m['line'] as number),
      );
      expect(memory).toBeDefined();
      const line = lines(w, 'law.answered').find((e) => e.id === row['line'])!;
      expect(line.causes).toContain(lines(w, 'law.set')[0]!.id);
    }
    expect(hoursOf(w, tilted, first!.id).workTo).toBe(18);
    expect(hoursOf(w, tilted, second!.id).workTo).toBe(20);
  });

  it('spreads a refusal to whoever sees the refuser down tools', () => {
    const w = band('smoke');
    const [first, second] = people(w);
    // Stand the second beside the first just before the customary end of work.
    step(w, sim, 18 * 60 - (w.tick % TICKS_PER_DAY) - 1);
    Object.assign(second!, { x: first!['x'], y: first!['y'], z: first!['z'] });
    first!['doing'] = second!['doing'] = 'work';
    step(w, sim, 2);
    const kept = lines(w, 'law.keptCustom');
    expect(kept.map((e) => e.actors)).toContainEqual([first!.id]);
    const saw = lines(w, 'law.saw').find((e) => e.actors?.includes(second!.id))!;
    expect(saw.causes).toEqual([kept[0]!.id]);
    const memory = memoriesOf(w, second!.id).find((m) => m['memory'] === 'saw-refused-long')!;
    expect(memory['line']).toBe(saw.id);
    expect(memory['about']).toBe(first!.id);
    // The why? chain walks from the memory's line back to the law being set.
    expect(whyOf(w, saw.id).map((c) => c.event.id)).toContain(lines(w, 'law.set')[0]!.id);
  });

  it('asks nothing at Customary', () => {
    const w = band('tallow');
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setLaw',
      data: { law: 'work-hours', setting: 'customary' },
    });
    step(w, sim, 2);
    expect(answers(w)).toEqual([]);
    expect(people(w).every((p) => hoursOf(w, tilted, p.id).workTo === 18)).toBe(true);
  });

  it('moves the warmth line with temperament and memories', () => {
    const w = createWorld(sim, 'anvil');
    const p = people(w)[0]!;
    const before = warmLineOf(w, tilted, p.id);
    addEntity(w, 'trait', { person: p.id, trait: 'hardy' });
    expect(warmLineOf(w, tilted, p.id)).toBe(before - 600);
    addEntity(w, 'memory', {
      person: p.id,
      memory: 'cold-night',
      until: w.tick + 99,
      line: w.begunEvent,
      about: 0,
    });
    expect(warmLineOf(w, tilted, p.id)).toBe(before - 300);
  });
});
