// P6.4 (V-156): the Memories tab's "Who they are" reads each role in words with what made it,
// and the ambition as wanted or done.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { addEntity, createSim, createWorld } from '../engine/index.ts';
import { selfView } from './selfview.ts';

describe('who they are on the Memories tab', () => {
  it('shows roles with their why and the ambition, wanted then done', () => {
    const w = createWorld(createSim(content), 'anvil');
    const p = (w.entities['person'] ?? []).find((q) => q['status'] === 'alive')!;
    w.entities['role'] = [];
    w.entities['ambition'] = [];
    const line = w.begunEvent;
    addEntity(w, 'role', {
      person: p.id,
      role: 'provider',
      points: 4,
      why: 'steady and hardy',
      line,
      since: 0,
    });
    const amb = { person: p.id, ambition: 'trade', skill: 'crafting', line, since: 0, done: 0 };
    const id = addEntity(w, 'ambition', amb);
    expect(selfView(w, p).self).toEqual({
      roles: [{ text: 'Sees themselves as the provider.', note: 'Steady and hardy.', why: line }],
      ambition: { text: 'Wants to learn crafting.', why: line },
    });
    w.entities['ambition']!.find((a) => a.id === id)!['done'] = 1;
    expect(selfView(w, p).self.ambition?.text).toBe('Set out to learn crafting, and did.');
  });
});
