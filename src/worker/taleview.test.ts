// P6.3 (V-155): the Memories tab's tales show the version held with the truth beside it when it
// differs and who told it, and beliefs read as one sentence with their strength.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { addEntity, createSim, createWorld } from '../engine/index.ts';
import { talesView } from './taleview.ts';

describe('tales on the Memories tab', () => {
  it('shows tale and truth side by side, the teller, and the belief in words', () => {
    const w = createWorld(createSim(content), 'anvil');
    const [bran, cai] = (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
    const words = JSON.stringify({ species: 'wolf', name: bran!['name'] });
    const story = addEntity(w, 'story', { tale: 'beast', event: w.begunEvent, words });
    const tale = { story, line: w.begunEvent, heard: 3, day: 3 };
    addEntity(w, 'tale', { person: bran!.id, level: 1, teller: 0, ...tale });
    addEntity(w, 'tale', { person: cai!.id, level: 3, teller: bran!.id, ...tale });
    addEntity(w, 'belief', {
      person: cai!.id,
      belief: 'woods-dangerous',
      strength: 3,
      line: w.begunEvent,
      fed: w.tick,
    });
    const seen = talesView(w, bran!);
    expect(seen.tales).toEqual([
      {
        how: 'Saw',
        text: `“A wolf went for ${bran!['name']}.”`,
        from: 'Saw it',
        why: w.begunEvent,
      },
    ]);
    const heard = talesView(w, cai!);
    expect(heard.tales[0]).toMatchObject({
      how: 'Heard',
      text: `“A whole pack set on ${bran!['name']}, who by rights should be dead.”`,
      truth: `A wolf went for ${bran!['name']}.`,
      from: `Heard from ${bran!['name']}, 4 ${content.calendar.monthNames[0]}`,
    });
    expect(heard.beliefs).toEqual([
      { text: 'Is sure the woods around the valley are dangerous.', why: w.begunEvent },
    ]);
  });
});
