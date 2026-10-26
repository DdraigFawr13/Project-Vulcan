// P5.13: daylight follows the month, and after dusk a lit workshop works while an unlit one stops,
// with a line. Dusk is moved to 15:00 in these worlds so the first week shows it.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { benchOf, createSim, createWorld, itemsOf, roomAt, step } from '../index.ts';
import { removeEntity } from '../entity/index.ts';
import { daylightAt, isDark } from './index.ts';

const DAY = 1440;

describe('daylight', () => {
  it('is the month’s own at mid-month and blends towards the next', () => {
    const month = 9; // Deepwinter
    const mid = (month * 28 + 14) * DAY;
    const [dawn, dusk] = content.lamp.daylight[month]!;
    const at = daylightAt(content, mid);
    expect(Math.abs(at.dawn - dawn! * 60)).toBeLessThanOrEqual(2);
    expect(Math.abs(at.dusk - dusk! * 60)).toBeLessThanOrEqual(2);
    // The first of Highsun lies between Bloommonth's and Highsun's dusk.
    const first = daylightAt(content, 3 * 28 * DAY).dusk;
    expect(first).toBeGreaterThan(content.lamp.daylight[2]![1]! * 60);
    expect(first).toBeLessThan(content.lamp.daylight[3]![1]! * 60);
    expect(isDark(content, mid + 12 * 60)).toBe(false);
    expect(isDark(content, mid + 17 * 60)).toBe(true);
  });
});

describe('light after dusk', () => {
  // Dusk at 15:00 every day of the year.
  const noon = {
    ...content,
    lamp: { ...content.lamp, daylight: content.lamp.daylight.map(() => [6, 15]) },
  };
  const sim = createSim(noon);
  const afternoon = (seed: string, candles: boolean) => {
    const world = createWorld(sim, seed);
    if (!candles)
      for (const i of [...itemsOf(world)])
        if (noon.lamp.candles.some((c) => c.item === i['kind'])) removeEntity(world, 'item', i.id);
    let atBench = 0;
    for (let t = 0; t < 8 * DAY; t += 1) {
      step(world, sim, 1);
      const hour = Math.floor((world.tick % DAY) / 60);
      const bench = benchOf(world);
      if (hour < 15 || hour >= 18 || !bench) continue;
      const room = roomAt(world, noon, bench['x'] as number, bench['y'] as number);
      for (const p of world.entities['person'] ?? [])
        if (
          p['job'] === 'carpentry' &&
          p['doing'] === 'work' &&
          room?.tiles.includes((p['y'] as number) * world.map.width + (p['x'] as number))
        )
          atBench += 1;
    }
    return { world, atBench };
  };

  it('works a lit workshop after dusk and stops an unlit one with a line', () => {
    const lit = afternoon('smoke', true);
    const litLines = lit.world.log.filter((e) => e.type === 'lamp.lit');
    expect(litLines.length).toBeGreaterThan(0);
    expect(lit.atBench).toBeGreaterThan(60);

    const dark = afternoon('smoke', false);
    const darkLines = dark.world.log.filter((e) => e.type === 'lamp.dark');
    expect(darkLines.length).toBeGreaterThan(0);
    expect(dark.world.log.some((e) => e.type === 'lamp.lit')).toBe(false);
    expect(darkLines[0]!.data['why']).toBe('no candles in store');
    // Nobody works at the dark bench after dusk, once the room has gone dark.
    expect(dark.atBench).toBeLessThan(lit.atBench / 10);
    // At most one went-dark line a day for the room.
    const days = new Set(darkLines.map((e) => Math.floor(e.tick / DAY)));
    expect(days.size).toBe(darkLines.length);
  });
});
