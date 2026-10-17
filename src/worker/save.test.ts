// The save boundary: a save survives the browser's structured clone (what IndexedDB and
// postMessage do to it) whole, and one from other content, another format or damaged is refused.
import { describe, expect, it } from 'vitest';
import { content, contentHash } from '../content/index.ts';
import { createSim, createWorld, step, toNdjson } from '../engine/index.ts';
import { checkSave, SAVE_VERSION, saveOf, type SaveFile } from './save.ts';

const sim = createSim(content);
const world = createWorld(sim, 'save-test');
step(world, sim, 3000);

describe('saves', () => {
  it('round-trips a world through a structured clone unchanged', () => {
    const save = structuredClone(saveOf(world, contentHash));
    expect(save).toMatchObject({ version: SAVE_VERSION, seed: 'save-test', tick: world.tick });
    const loaded = checkSave(save, contentHash, content);
    expect(loaded).toEqual(world);
    // Save, reload and continue gives the same ledger as an unbroken run (the P0.5 done-when).
    const unbroken = structuredClone(world);
    step(loaded, sim, 40320);
    step(unbroken, sim, 40320);
    expect(toNdjson(loaded.log)).toBe(toNdjson(unbroken.log));
  });

  it('refuses a save from other content, another format or damaged', () => {
    const save = () => structuredClone(saveOf(world, contentHash));
    const check = (s: unknown) => () => checkSave(s, contentHash, content);
    expect(check({ ...save(), contentHash: 'other' })).toThrow(
      'different game content (other in the save',
    );
    expect(check({ ...save(), version: 0 })).toThrow('save format 0');
    expect(check('{}')).toThrow('damaged');
    // A map or ledger broken inside a well-formed record is caught too.
    const damage = [
      (s: SaveFile) => s.state.map.tiles.pop(),
      (s: SaveFile) => (s.state.map.tiles[5] = 99),
      (s: SaveFile) => s.state.map.chunkVersions.pop(),
      (s: SaveFile) => s.state.log.reverse(),
      (s: SaveFile) => (s.state.nextEventId = 1),
      (s: SaveFile) => (s.state.map.biomes = new Uint8Array(3)),
      (s: SaveFile) => (s.state.map.features[0] = 250),
      (s: SaveFile) => (s.state.map.startX = 1e6),
    ];
    for (const hurt of damage) {
      const bad = save();
      hurt(bad);
      expect(check(bad)).toThrow('damaged');
    }
  });
});
