// Audit 2026-11-23 (anvil, Edwin): someone standing on lake ice when it melted stayed on that water
// tile for good, since a way is found only from ground that can be stood on. Now they wade out to
// the nearest ground, a tile every `walking.wade` minutes, and the ledger says so.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, step } from '../index.ts';
import { raiseChunk } from '../map/index.ts';
import { walkAt, wayAshore } from '../paths/index.ts';

describe('the ice melts under someone', () => {
  it('they wade out to ground and the ledger names them', () => {
    const sim = createSim(content);
    const w = createWorld(sim, 'anvil');
    const { map } = w;
    // Melt every frozen tile now, as a thaw would.
    for (let i = 0; i < map.ice.length; i += 1) {
      if (!map.ice[i]) continue;
      map.ice[i] = 0;
      raiseChunk(map, i % map.width, Math.floor(i / map.width));
    }
    // The open lake tile farthest from ground, through water, within a few tiles.
    let deep = -1;
    let far = 0;
    for (let i = 0; i < map.tiles.length; i += 1) {
      if (!map.water[i] || walkAt(content, map, 0, i)) continue;
      const way = wayAshore(content, map, { x: i % map.width, y: Math.floor(i / map.width), z: 0 });
      if (way && way.length > far && way.length <= 4) [deep, far] = [i, way.length];
    }
    expect(far).toBeGreaterThan(1);
    const p = w.entities['person']!.find((q) => q['status'] === 'alive')!;
    p['x'] = deep % map.width;
    p['y'] = Math.floor(deep / map.width);
    p['z'] = 0;
    p['path'] = [];
    step(w, sim, far * content.terrain.walking.wade + 1);
    const at = (p['y'] as number) * map.width + (p['x'] as number);
    expect(walkAt(content, map, 0, at)).toBeGreaterThan(0);
    const out = allLines(w).filter((e) => e.type === 'people.wadedOut');
    expect(out.map((e) => e.actors)).toEqual([[p.id]]);
    expect(out[0]!.data).toMatchObject({ name: p['name'], water: 'lake' });
  });
});
