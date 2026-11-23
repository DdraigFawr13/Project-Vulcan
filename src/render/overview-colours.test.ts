import { describe, expect, it } from 'vitest';
import type { LevelArrays } from './chunk-store.ts';
import { FADE } from './fade.ts';
import { mix, overColour, type Colours, type Rgba } from './overview-colours.ts';

const GRASS: Rgba = [60, 120, 40, 255];
const TREE: Rgba = [20, 50, 20, 255];
const ORE: Rgba = [200, 100, 50, 255];

const colours: Colours = {
  kinds: [GRASS],
  features: [
    { rgb: TREE, cover: 0.5 },
    { rgb: ORE, cover: 0.4 },
  ],
  parts: [{ rgb: [150, 150, 150, 255], cover: 1 }],
  snow: [240, 240, 250, 255],
  lying: { rgb: [250, 250, 255, 255], cover: 1 },
  ice: [180, 210, 230, 255],
  page: [222, 208, 176, 255],
  field: () => undefined,
};

const tile = (over: Partial<Record<keyof LevelArrays, number>>): LevelArrays => {
  const one = (k: keyof LevelArrays) => Uint8Array.of(over[k] ?? 0);
  return {
    ground: one('ground'),
    snow: one('snow'),
    ice: one('ice'),
    things: one('things'),
    known: Uint8Array.of(over.known ?? 1),
    built: one('built'),
    snowLie: one('snowLie'),
  };
};

describe('the overview colours', () => {
  it('paints a tile its ground colour, darkened by a tree by how much of it the tree covers', () => {
    expect(overColour(colours, tile({}), 0)).toEqual(GRASS);
    const wood = overColour(colours, tile({ things: 1 }), 0);
    expect(wood).toEqual(mix(GRASS, TREE, 0.5));
    expect(wood[1]).toBeLessThan(GRASS[1]);
  });

  it('keeps unknown rock black, a vein in it too (V-030, V-215)', () => {
    expect(overColour(colours, tile({ known: 0, things: 1 }), 0)).toEqual([0, 0, 0, 255]);
    expect(overColour(colours, tile({ known: 0, things: 2 }), 0)).toEqual([0, 0, 0, 255]);
  });

  it('shows ice, snow and built parts from their own colours', () => {
    expect(overColour(colours, tile({ ice: 1 }), 0)).toEqual(colours.ice);
    expect(overColour(colours, tile({ snow: 1 }), 0)).toEqual(colours.snow);
    expect(overColour(colours, tile({ built: 1 }), 0)).toEqual([150, 150, 150, 255]);
  });

  it('fades unseen surface into the page, its ground only, with nothing on it (V-213)', () => {
    const unseen = overColour(colours, tile({ known: 0, things: 1 }), 0, true);
    expect(unseen).toEqual(mix(colours.page, GRASS, FADE));
    expect(overColour(colours, tile({ known: 0, snow: 1 }), 0, true)).toEqual(
      mix(colours.page, colours.snow, FADE),
    );
    // Seen surface is drawn in full, as before.
    expect(overColour(colours, tile({ things: 1 }), 0, true)).toEqual(mix(GRASS, TREE, 0.5));
  });
});
