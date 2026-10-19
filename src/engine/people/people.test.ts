// P2.1's done-when: ten seeds give ten distinct bands, each with someone able to build and cook;
// and the band arrives in a world as rows standing on open ground, named in one ledger line.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index';
import { streamFor } from '../core/index.ts';
import { entityOf } from '../entity/index.ts';
import { createSim, createWorld } from '../index.ts';
import { drawBand, tradeOf, type Home } from './index.ts';

const SEEDS = Array.from({ length: 10 }, (_, k) => `band-${k + 1}`);
const CULTURES = content.cultures.map((c) => c.id);

// Three neighbouring settlements per seed, of cultures that vary by seed, as a region would give.
const homesFor = (k: number): Home[] =>
  [0, 1, 2].map((j) => ({
    name: `Home ${k}-${j}`,
    culture: CULTURES[(k * 5 + j * 3) % CULTURES.length]!,
    days: 2 + j * 4,
    dir: 'north',
  }));

describe('the band', () => {
  const bands = SEEDS.map((seed, k) =>
    drawBand(streamFor({ seed, rng: {} }, 'people'), content, homesFor(k)),
  );

  it('ten seeds give ten distinct bands, each able to build and cook', () => {
    const { band } = content;
    expect(new Set(bands.map((b) => b.map((p) => p.name).join())).size).toBe(10);
    for (const b of bands) {
      expect(b).toHaveLength(band.size);
      expect(new Set(b.map((p) => p.name)).size).toBe(band.size);
      for (const must of band.must)
        expect(b.some((p) => p.skills[must]!.level >= band.able)).toBe(true);
    }
  });

  it('gives each person a fitting age, skills within potential and their best skill as trade', () => {
    for (const p of bands.flat()) {
      const race = content.races.find((r) => r.id === p.race)!;
      expect(p.age).toBeGreaterThan(race.maturityYears);
      expect(p.age).toBeLessThan(race.lifespanYears);
      expect(p.name).not.toMatch(/(.)\1\1/i);
      for (const s of Object.values(p.skills)) expect(s.level).toBeLessThanOrEqual(s.potential);
      expect(p.trade).toBe(tradeOf(content.band, p.skills));
    }
  });

  it('arrives in a new world on open ground, named in one ledger line', () => {
    const world = createWorld(createSim(content), 'band-world');
    const people = world.entities['person']!;
    expect(people).toHaveLength(content.band.size);
    const line = world.log.find((e) => e.type === 'people.arrived')!;
    for (const p of people) {
      const i = (p['y'] as number) * world.map.width + (p['x'] as number);
      expect(content.terrain.kinds[world.map.tiles[i]!]!.water).toBeUndefined();
      expect(p['arrived']).toBe(line.id);
      expect(String(line.data['names'])).toContain(p['name'] as string);
    }
    const skills = world.entities['skill']!.filter((s) => s['person'] === people[0]!.id);
    // Smithing (Bundle 3) is drawn apart from the band, after it: one more row.
    expect(skills).toHaveLength(content.band.skills.length + 1);
    expect(entityOf(world, 'person', people[0]!.id)).toBe(people[0]);
  });
});
