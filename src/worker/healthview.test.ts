// The Health view as the page shows it (P5.6, P5.8): a test-mode wound shows on the figure and in a
// sentence; a death shows the dead's sentences, the dead keep their sheet, the buried leave.
import { describe, expect, it } from 'vitest';
import { content as game } from '../content/index.ts';
import { createSim, createWorld, step, submitCommand, withoutAccidents } from '../engine/index.ts';
import { walkersOf } from './people.ts';

const calm = withoutAccidents(game);
const mortal = {
  ...calm,
  health: {
    ...calm.health,
    severities: calm.health.severities.map((s) => (s.id === 'grave' ? { ...s, mortal: 100 } : s)),
  },
};

describe('health view', () => {
  it('has none for someone never hurt', () => {
    const w = createWorld(createSim(calm), 'ledger');
    expect(walkersOf(w).every((x) => x.health === undefined)).toBe(true);
  });

  it('shows a deep wound: bleeding part, state, title, status and a hint for a mark', () => {
    const sim = createSim(calm);
    const w = createWorld(sim, 'ledger');
    const id = (w.entities['person'] ?? [])[0]!.id;
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'hurt',
      data: { person: id, part: 'left-leg', severity: 'deep' },
    });
    step(w, sim, 2);
    const h = walkersOf(w).find((x) => x.health)!.health!;
    expect(h.badge).toBe('hurt');
    expect(h.text).toMatch(/^Hurt( and bleeding)?\. /);
    expect(['bleeding', 'healing']).toContain(h.parts.find((q) => q.id === 'left-leg')!.status);
    expect(h.parts.find((q) => q.id === 'head')!.status).toBe('none');
    expect(h.wounds[0]!.title).toBe('Cut left leg · deep');
    expect(h.wounds[0]!.status).toMatch(/^Bleeding slowly|^Bound roughly/);
    expect(h.blood).toMatchObject({ share: 100, line: 40 });
    expect(h.hint).toMatch(/lasting mark/);
  });

  it('keeps the dead on the strip greyed with their sentence and cause, then drops the buried', () => {
    const sim = createSim(mortal);
    const w = createWorld(sim, 'ledger');
    const id = (w.entities['person'] ?? [])[0]!.id;
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'hurt',
      data: { person: id, part: 'body', severity: 'grave' },
    });
    for (let hour = 0; hour < 30; hour += 1) {
      step(w, sim, 60);
      if ((w.entities['person'] ?? []).find((p) => p.id === id)!['status'] === 'dead') break;
    }
    const x = walkersOf(w).find((v) => v.id === id)!;
    expect(x.health!.badge).toBe('dead');
    expect(x.health!.text).toMatch(/^Dead\. /);
    expect(x.health!.parts.find((q) => q.id === 'body')!.status).toBe('bleeding');
    expect(x.health!.death).toBeGreaterThan(0);
    expect(x.now.text).toMatch(/^Died at \d\d:\d\d today, .*Not yet buried\.$/);
    expect(x.now.why).toBe(x.health!.death);
    (w.entities['person'] ?? []).find((p) => p.id === id)!['status'] = 'buried';
    expect(walkersOf(w).find((v) => v.id === id)!.health!.buried).toBe(true);
  });
});
