// The Wearing rows (P5.5): a garment whose making line has been sealed into the older record
// still shows, with "made here" in place of the maker (the live game stopped on this).
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld } from '../engine/index.ts';
import { addEntity } from '../engine/entity/index.ts';
import { wearingRows } from './clothesview.ts';

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
});
