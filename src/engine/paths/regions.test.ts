// The regions mend only the chunks that changed (relink), and the links, costs and
// components come out as a full rebuild on a fresh copy of the map would make them: through
// walls tried and taken down, felled trees, and stairs and a shaft to the levels below.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { MapState } from '../core/index.ts';
import { layerOf, raiseChunk, withBuiltAll } from '../map/index.ts';
import { createSim, createWorld, step, submitCommand } from '../index.ts';
import { regionsOf } from './regions.ts';

/** Every region with its component and its links in id order, and each level's labels. */
function shape(map: MapState) {
  const r = regionsOf(content, map);
  const regions = [...r.regions.values()]
    .sort((a, b) => a.id - b.id)
    .map((g) => [g.id, g.component, [...g.links].sort((a, b) => a[0] - b[0])]);
  return { labels: r.labels.map((l) => Array.from(l)), regions };
}

describe('regions', () => {
  it('mend changed chunks to the same links as a fresh rebuild', () => {
    const sim = createSim(content);
    const world = createWorld(sim, 'ledger');
    const { map } = world;
    const w = map.width;
    const wall = content.buildings.parts.findIndex((p) => p.kind === 'wall') + 1;
    regionsOf(content, map);
    // A wall across a chunk edge, tried and taken down again (as a builder asks before planning).
    const row = Array.from({ length: 20 }, (_, k) => (map.startY + 2) * w + map.startX - 10 + k);
    withBuiltAll(map, row, wall, () => expect(shape(map)).toEqual(shape(structuredClone(map))));
    expect(shape(map)).toEqual(shape(structuredClone(map)));
    // Trees felled in a few chunks.
    let felled = 0;
    for (let i = 0; i < map.features.length && felled < 6; i += 997)
      if (map.features[i]! && content.features[map.features[i]! - 1]!.blocks) {
        map.features[i] = 0;
        raiseChunk(map, i % w, Math.floor(i / w));
        felled += 1;
      }
    expect(felled).toBeGreaterThan(0);
    expect(shape(map)).toEqual(shape(structuredClone(map)));
    // Stairs, then a shaft from the stairs' foot: new levels and links through them.
    const east = { x: map.startX + 1, y: map.startY };
    submitCommand(world, { tick: world.tick + 1, kind: 'cutStairs', data: { ...east, z: 0 } });
    step(world, sim, 1);
    regionsOf(content, map);
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'sinkShaft',
      data: { ...east, z: 1, to: 2 },
    });
    step(world, sim, 1);
    expect(shape(map)).toEqual(shape(structuredClone(map)));
    // A cave opened beside the shaft on level 1: that chunk mends its links up and down.
    const level = layerOf(map, 1)!;
    const cave = content.terrain.kinds.findIndex(
      (k) => k.id === content.terrain.generator.underground.caves.kind,
    );
    const foot = east.y * w + east.x;
    for (const i of [foot - 1, foot + w, foot - w]) level.tiles[i] = cave;
    raiseChunk(map, east.x, east.y, 1);
    expect(shape(map)).toEqual(shape(structuredClone(map)));
    // A wall round the stairs' head on the surface cuts the links to the levels below.
    const ring = [-1, 0, 1].flatMap((dy) =>
      [-1, 0, 1].map((dx) => (east.y + dy) * w + east.x + dx),
    );
    withBuiltAll(map, ring, wall, () => expect(shape(map)).toEqual(shape(structuredClone(map))));
  });
});
