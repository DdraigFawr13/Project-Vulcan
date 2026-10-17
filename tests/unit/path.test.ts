import { describe, expect, it } from 'vitest';
import { Terrain, type TileMap } from '../../src/engine/index.ts';
import { findNearest, findPath } from '../../src/engine/world/path.ts';

/** 5×3 fixture: a wall of water in column 2 with one gap at the bottom. */
function fixture(): TileMap {
  const width = 5;
  const height = 3;
  const map: TileMap = {
    width,
    height,
    terrain: new Uint8Array(width * height),
    feature: new Uint8Array(width * height),
    amount: new Uint8Array(width * height),
    regrowAt: new Uint32Array(width * height),
    reservedBy: new Uint16Array(width * height),
  };
  map.terrain[0 * width + 2] = Terrain.Water;
  map.terrain[1 * width + 2] = Terrain.Water;
  return map;
}

describe('path', () => {
  it('walks around water through the gap', () => {
    const map = fixture();
    const path = findPath(map, 0, 4)!;
    expect(path).toHaveLength(8);
    expect(path).toContain(2 * 5 + 2);
    expect(path.at(-1)).toBe(4);
  });

  it('finds the nearest match and returns null when none is reachable', () => {
    const map = fixture();
    expect(findNearest(map, 0, (i) => i === 1 || i === 10)).toEqual([1]);
    map.terrain[2 * 5 + 2] = Terrain.Rock;
    expect(findPath(map, 0, 4)).toBeNull();
  });
});
