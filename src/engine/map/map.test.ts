import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld } from '../index.ts';
import { countsAround } from './features.ts';
import { MAP_SEEDS } from './seeds.ts';

// P1.1 done-when: every seed's start has buildable land, wood and stone within reach.
describe('surface map', () => {
  const sim = createSim(content);
  const need = content.terrain.generator.start;
  it.each(MAP_SEEDS)('seed %s starts with land, wood and stone nearby', (seed) => {
    const { map } = createWorld(sim, seed);
    const near = countsAround(
      content,
      map.tiles,
      map.features,
      map.width,
      map.height,
      need.radius,
    )(map.startX, map.startY);
    expect(near.buildable).toBeGreaterThanOrEqual(need.buildable);
    expect(near.wood).toBeGreaterThanOrEqual(need.wood);
    expect(near.stone).toBeGreaterThanOrEqual(need.stone);
  });
});
