// Seen at work (V-194): the people view says what the map draws, from jobs.json: the motion and
// effect of the job a person stands working, the tool serving it (also while walking there), and
// the load they carry instead.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, itemsOf } from '../engine/index.ts';
import { seenOf } from './seen.ts';

function felling() {
  const w = createWorld(createSim(content), 'anvil');
  const p = (w.entities['person'] ?? []).find((q) => q['status'] === 'alive')!;
  const axe = itemsOf(w).find((i) => i['kind'] === 'stone-axe')!;
  Object.assign(axe, { state: 'held', owner: p.id });
  for (const i of itemsOf(w)) if (i['holder'] === p.id) i['holder'] = 0;
  Object.assign(p, { doing: 'work', job: 'fell', task: '', path: [] });
  return { w, p };
}

describe('what the map shows of work', () => {
  it('a feller at the tree swings the axe with the chips jobs.json names', () => {
    const { w, p } = felling();
    const fell = content.jobs.find((j) => j.id === 'fell')!;
    expect(seenOf(w, p)).toEqual({
      held: 'item.stone-axe',
      act: { motion: fell.motion, effect: fell.effect },
    });
    expect(fell.motion).toBe('swing');
  });

  it('walking there they hold the axe but do not swing; carrying they show the load only', () => {
    const { w, p } = felling();
    p['path'] = [1, 2];
    expect(seenOf(w, p)).toEqual({ held: 'item.stone-axe' });
    const logs = itemsOf(w).find((i) => i['kind'] !== 'stone-axe' && i['state'] !== 'held')!;
    logs['holder'] = p.id;
    expect(seenOf(w, p)).toEqual({ load: `item.${logs['kind'] as string}` });
  });

  it('a job with no drawn motion shows none, and resting shows nothing', () => {
    const { w, p } = felling();
    p['job'] = 'haul';
    expect(seenOf(w, p).act).toBeUndefined();
    p['doing'] = 'sleep';
    expect(seenOf(w, p)).toEqual({});
  });
});
