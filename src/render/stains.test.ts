import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { TILE } from './frames.ts';
import { SPECKLES, speckles, stainColour } from './stains.ts';

describe('ore stains', () => {
  it('give a tile the same speckles every time, all inside the tile', () => {
    expect(speckles(40, 57)).toEqual(speckles(40, 57));
    expect(speckles(40, 57)).not.toEqual(speckles(41, 57));
    for (const [x, y] of [
      [0, 0],
      [3, 9],
      [149, 149],
      [71, 12],
    ] as const) {
      const list = speckles(x, y);
      expect(list).toHaveLength(SPECKLES);
      for (const s of list) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.x + s.size).toBeLessThanOrEqual(TILE);
        expect(s.y + s.size).toBeLessThanOrEqual(TILE);
      }
    }
  });

  it('take their colour from the vein in content: rust for iron, grey for tin', () => {
    const at = (id: string) => content.features.findIndex((f) => f.id === id) + 1;
    expect(stainColour(at('iron'))).toBe(0x9a4a26);
    expect(stainColour(at('tin'))).toBe(0x8a8a8e);
    expect(stainColour(at('copper'))).toBeDefined();
    expect(stainColour(at('oak'))).toBeUndefined();
    expect(stainColour(0)).toBeUndefined();
  });
});
