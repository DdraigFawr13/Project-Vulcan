// The save boundary: a save survives the browser's structured clone (what IndexedDB and
// postMessage do to it) whole, and one from other content, another format or damaged is refused.
import { describe, expect, it } from 'vitest';
import { content, contentHash } from '../content/index.ts';
import { createSim, createWorld, step } from '../engine/index.ts';
import { checkSave, SAVE_VERSION, saveOf } from './save.ts';

const sim = createSim(content);
const world = createWorld(sim, 'save-test');
step(world, sim, 3000);

describe('saves', () => {
  it('round-trips a world through a structured clone unchanged', () => {
    const save = structuredClone(saveOf(world, contentHash));
    expect(save).toMatchObject({ version: SAVE_VERSION, seed: 'save-test', tick: world.tick });
    expect(checkSave(save, contentHash)).toEqual(world);
  });

  it('refuses a save from other content, another format or damaged', () => {
    const save = () => structuredClone(saveOf(world, contentHash));
    expect(() => checkSave({ ...save(), contentHash: 'other' }, contentHash)).toThrow(
      'different game content (other in the save',
    );
    expect(() => checkSave({ ...save(), version: 0 }, contentHash)).toThrow('save format 0');
    const cut = save();
    cut.state.map.tiles.pop();
    expect(() => checkSave(cut, contentHash)).toThrow('damaged');
    expect(() => checkSave('{}', contentHash)).toThrow('damaged');
  });
});
