import { describe, expect, it } from 'vitest';
import { areaFor, covers, spanFor } from './tile-window.ts';

const PHONE = { width: 390, height: 844 };
const MAP = { width: 250, height: 250 };

describe('the window of tiles near the camera', () => {
  it('covers a phone screen at the overview line with a chunk to spare, in whole chunks', () => {
    // At ½× a 390 by 844 px screen shows 24.4 by 52.8 tiles.
    const span = spanFor(PHONE, MAP);
    expect(span).toEqual({ w: 80, h: 112 });
    expect(span.w * span.h).toBeLessThan((MAP.width * MAP.height) / 6);
  });

  it('is never bigger than the map, rounded out to whole chunks', () => {
    expect(spanFor({ width: 4000, height: 3000 }, { width: 150, height: 150 })).toEqual({
      w: 160,
      h: 160,
    });
  });

  it('centres on the view, chunk-aligned, and keeps inside the map', () => {
    const span = { w: 80, h: 112 };
    const view = { x: 100, y: 120, w: 24.4, h: 52.8 };
    const area = areaFor(view, span, MAP);
    expect(area.x % 16).toBe(0);
    expect(area.y % 16).toBe(0);
    expect(covers(area, view, MAP)).toBe(true);
    expect(areaFor({ x: -10, y: -10, w: 24, h: 52 }, span, MAP)).toMatchObject({ x: 0, y: 0 });
    // Hard against the far edge the window holds the last chunks (250 tiles end in a part chunk).
    const corner = areaFor({ x: 226, y: 198, w: 24, h: 52 }, span, MAP);
    expect(corner).toMatchObject({ x: 176, y: 144 });
    expect(covers(corner, { x: 226, y: 198, w: 24, h: 52 }, MAP)).toBe(true);
  });

  it('asks to move once the view leaves it, but not for the part off the map', () => {
    const area = { x: 64, y: 64, w: 80, h: 112 };
    expect(covers(area, { x: 70, y: 70, w: 24, h: 52 }, MAP)).toBe(true);
    expect(covers(area, { x: 130, y: 70, w: 24, h: 52 }, MAP)).toBe(false);
    const edge = { x: 176, y: 144, w: 80, h: 112 };
    expect(covers(edge, { x: 240, y: 230, w: 24, h: 52 }, MAP)).toBe(true);
  });
});
