// P6.3 (V-155): the Memories tab's tales show the version held with the truth beside it when it
// differs and who told it, and beliefs read as one sentence with their strength.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { addEntity, createSim, createWorld, talesSystem } from '../engine/index.ts';
import { giveByname } from '../engine/tales/bynames.ts';
import { contextFor } from '../engine/sim/system.ts';
import { lineOf } from './lines.ts';
import { peopleOf } from './people.ts';
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

  it('shows a byname with its tale and the truth, on the sheet and in later lines', () => {
    const sim = createSim(content);
    const w = createWorld(sim, 'anvil');
    const [bran] = (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
    const name = bran!['name'] as string;
    const words = JSON.stringify({ species: 'wolf', name });
    const story = addEntity(w, 'story', {
      tale: 'beast',
      event: w.begunEvent,
      words,
      about: bran!.id,
    });
    const row = (w.entities['story'] ?? []).find((s) => s.id === story)!;
    const ctx = contextFor(w, sim, talesSystem);
    giveByname(ctx, bran!, 'Wolfbait', row, 3, w.begunEvent);
    const named = ctx.world.log.at(-1)!;
    expect(talesView(w, bran!).byname).toEqual({
      word: 'Wolfbait',
      text: `A whole pack set on ${name}, who by rights should be dead.`,
      truth: `A wolf went for ${name}.`,
      why: named.id,
    });
    expect(peopleOf(w).find((p) => p.id === bran!.id)?.byname).toBe('Wolfbait');
    // The naming line keeps the plain name; lines after it carry the byname.
    expect(lineOf(w, sim, named).text).not.toContain('“Wolfbait”');
    const later = { ...named, id: named.id + 1, type: 'tale.byname' };
    expect(lineOf(w, sim, later).text).toContain(`${name} “Wolfbait”`);
  });
});
