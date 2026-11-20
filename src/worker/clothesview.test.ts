// The Wearing rows (P5.5): a garment whose making line has been sealed into the older record
// still shows, with "made here" in place of the maker (the live game stopped on this). The coat
// drawn on them (V-190) shows only outdoors in the cold, ragged or fine by its life and worth.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, lifeOf, wornIn } from '../engine/index.ts';
import { addEntity } from '../engine/entity/index.ts';
import { coatOf, wearingRows } from './clothesview.ts';

const sim = createSim(content);

describe('clothes view', () => {
  it('words a garment whose making line is older than the ledger keeps', () => {
    const w = createWorld(sim, 'clothes-view');
    const p = w.entities['person']![0]!;
    const kind = content.clothes.garments[0]!.item;
    // A stub keeps a sealed line's id, tick and type, but not its actors.
    const id = w.log.at(-1)!.id + 1000;
    w.stubs.push({ id, tick: w.tick, type: 'clothes.made' });
    for (const i of w.entities['item'] ?? [])
      if (i['holder'] === p.id && i['state'] === 'worn') i['state'] = '';
    addEntity(w, 'item', {
      kind,
      count: 1,
      x: -1,
      y: -1,
      z: 0,
      holder: p.id,
      state: 'worn',
      made: id,
      quality: content.clothes.worth[0]!.id,
      wear: 100,
    });
    const row = wearingRows(w, p).find((r) => r.why === id);
    expect(row?.detail).toMatch(/^made here · /);
  });

  it('draws the outer garment only outdoors in the cold, ragged or fine by its life and worth', () => {
    const w = createWorld(sim, 'clothes-view');
    const p = w.entities['person']![0]!;
    const weather = w.systems['weather']!;
    const cloak = wornIn(w, content, p.id, content.clothes.slots[1]!.id)!;
    weather['temp'] = 40;
    expect(coatOf(w, p)).toBeUndefined();
    weather['temp'] = -20;
    expect(coatOf(w, p)).toMatchObject({ art: 'cloak', look: 'plain' });
    const z = p['z']!;
    p['z'] = 1;
    expect(coatOf(w, p)).toBeUndefined();
    p['z'] = z;
    const full = lifeOf(content, 'cloak', cloak['quality'] as string);
    cloak['wear'] = Math.floor((full * (content.clothes.ragged - 1)) / 100);
    expect(coatOf(w, p)?.look).toBe('ragged');
    cloak['quality'] = content.clothes.worth[0]!.id;
    cloak['wear'] = lifeOf(content, 'cloak', cloak['quality'] as string);
    expect(coatOf(w, p)?.look).toBe('fine');
  });
});
