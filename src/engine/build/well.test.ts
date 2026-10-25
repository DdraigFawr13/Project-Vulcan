// P5.2 (V-131): a thirsty person walks to water and drinks to full; the colony plans one well on
// the green when the water most drunk from freezes or the walks to drink grow long, and plans
// none while water is near.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  furnitureOf,
  needOf,
  step,
  waterSpots,
  wellsOf,
  withoutAccidents,
  whyOf,
} from '../index.ts';

// Accidents (P5.6) are left out: this tests drinking and the well, not injury.
const content = withoutAccidents(game);
const sim = createSim(content);
const DAY = 1440;
const wellLines = (w: ReturnType<typeof createWorld>) =>
  allLines(w).filter((e) => e.type === 'build.wellNeeded' || e.type === 'build.wellBuilt');

describe('drinking and the well', () => {
  it('sends a thirsty person to the water, to drink to full, with no line per drink', () => {
    const w = createWorld(sim, 'ledger');
    const p = w.entities['person']![0]!;
    const row = needOf(w, p.id, 'water')!;
    row['value'] = 4000;
    const before = allLines(w).length;
    let drinking = false;
    for (let m = 0; m < 180 && (row['value'] as number) < 9000; m += 1) {
      step(w, sim, 1);
      drinking ||= p['doing'] === 'drink';
    }
    expect(drinking).toBe(true);
    expect(row['value']).toBeGreaterThanOrEqual(9000);
    expect(
      (w.entities['drink'] ?? []).reduce((n, r) => n + (r['drinks'] as number), 0),
    ).toBeGreaterThan(0);
    // Under its warning line was never reached, so a drink writes no need line of its own.
    expect(
      allLines(w)
        .slice(before)
        .filter((e) => e.type.startsWith('need.') && e.actors.includes(p.id)),
    ).toHaveLength(0);
  });

  it('plans no well while the water is near', () => {
    const w = createWorld(sim, 'ledger');
    step(w, sim, 6 * DAY);
    expect(wellLines(w)).toHaveLength(0);
    expect(furnitureOf(w).filter((f) => f['kind'] === 'well')).toHaveLength(0);
  });

  it('plans one well on the green when the water most drunk from freezes, and builders make it', () => {
    const w = createWorld(sim, 'ledger');
    // Up to the hour before a day's end: the colony reads the week at midnight.
    step(w, sim, 4 * DAY);
    step(w, sim, (Math.floor(w.tick / DAY) + 1) * DAY - w.tick - 60);
    const rows = w.entities['drink']!;
    const drunk = new Map<number, number>();
    for (const r of rows)
      drunk.set(
        r['tile'] as number,
        (drunk.get(r['tile'] as number) ?? 0) + (r['drinks'] as number),
      );
    const [tile] = [...drunk].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
    w.map.ice[tile] = 0x80 | content.seasons.ice.cap;
    step(w, sim, 120);
    const needed = wellLines(w).filter((e) => e.type === 'build.wellNeeded');
    expect(needed).toHaveLength(1);
    expect(needed[0]!.data['why']).toContain('froze');
    expect(whyOf(w, needed[0]!.id).length).toBeGreaterThan(0);
    const plan = furnitureOf(w).filter((f) => f['kind'] === 'well');
    expect(plan).toHaveLength(1);
    expect(plan[0]!['line']).toBe(needed[0]!.id);
    // The frozen tile is no longer a place to drink.
    const frozen = { x: tile % w.map.width, y: Math.floor(tile / w.map.width) };
    expect(waterSpots(w, content).some((s) => s.x === frozen.x && s.y === frozen.y)).toBe(false);
    for (let d = 0; d < 20 && !wellsOf(w).length; d += 1) step(w, sim, DAY);
    expect(wellsOf(w)).toHaveLength(1);
    expect(wellLines(w).filter((e) => e.type === 'build.wellBuilt')).toHaveLength(1);
    expect(
      waterSpots(w, content).some(
        (s) => s.x === wellsOf(w)[0]!['x'] && s.y === wellsOf(w)[0]!['y'],
      ),
    ).toBe(true);
    // Still one well.
    step(w, sim, 3 * DAY);
    expect(furnitureOf(w).filter((f) => f['kind'] === 'well')).toHaveLength(1);
  });

  it('plans a well when the walks to drink are long, the line naming the minutes', () => {
    const long = {
      ...content,
      buildings: { ...content.buildings, well: { ...content.buildings.well, walk: 1 } },
    };
    const w = createWorld(createSim(long), 'ledger');
    step(w, createSim(long), 5 * DAY);
    const needed = wellLines(w).filter((e) => e.type === 'build.wellNeeded');
    expect(needed).toHaveLength(1);
    expect(needed[0]!.data['why']).toMatch(/walks \d+ minutes a day to drink/);
  });
});
