// The lamp as the page shows it (P5.13): the clock and day carry today's first light and dusk, a
// room's Light row follows the hour and its candle, and the Candles plate names the stores.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, daylightAt } from '../engine/index.ts';
import { addEntity } from '../engine/entity/index.ts';
import { stockView } from './goods.ts';
import { roomLight, sunOf } from './lampview.ts';
import { clockView } from './views.ts';

const sim = createSim(content);

describe('lamp views', () => {
  it('hands the page first light and dusk in hours', () => {
    const w = createWorld(sim, 'lamp-view');
    const { dawn, dusk } = daylightAt(content, w.tick);
    expect(sunOf(w.tick)).toEqual({ dawn: dawn / 60, dusk: dusk / 60 });
    expect(clockView(w.tick).dusk).toBeGreaterThan(clockView(w.tick).dawn);
  });

  it('words a room’s light: daylight by day, candle or dark by night', () => {
    const w = createWorld(sim, 'lamp-view');
    const day = w.tick - (w.tick % 1440);
    w.tick = day + 12 * 60;
    expect(roomLight(w, 3, 3)).toBe('Daylight');
    w.tick = day + 23 * 60;
    expect(roomLight(w, 3, 3)).toBe('Dark after dusk');
    // A candle that burned this minute lights the room, with the time it has left.
    addEntity(w, 'light', { room: -1, kind: 'candle', left: 125, used: w.tick, line: 0, dark: -1 });
    expect(roomLight(w, 3, 3)).toBe('Candlelit · 2 h 5 min of candle left');
  });

  it('names the candles with the cart, the soap and what makes more on the plate', () => {
    const w = createWorld(sim, 'lamp-view');
    const note = stockView(w).find((s) => s.good === 'candles')!.note!;
    expect(note).toContain(`${content.lamp.cart.count} with the cart`);
    expect(note).toContain('To make more:');
    expect(note).not.toContain('{candles}');
  });
});
