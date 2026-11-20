// The ragged and fine coats (V-190) on a real villager's drawings: only coat pixels change, a
// ragged coat is duller with its hem torn to the tunic or to nothing, a fine one gains brass, and
// the same seed always tears it the same way.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error the art tools are plain JavaScript
import { decodePng } from '../../tools/png.mjs';
import { coatLook, coatMask, readPalette } from './coat-look.ts';

const palette = readPalette(readFileSync('art/palette.gpl', 'utf8'));
const frame = (name: string): Uint8ClampedArray =>
  new Uint8ClampedArray(decodePng(readFileSync(`art/final/sprites-people/${name}.png`)).data);
const lum = (d: Uint8ClampedArray, cells: number[]) =>
  cells.reduce((n, p) => n + d[p * 4]! * 3 + d[p * 4 + 1]! * 4 + d[p * 4 + 2]!, 0) / cells.length;

describe('coat looks', () => {
  const base = frame('person.human.v1.s.0');
  const coat = frame('person.human.v1.cloak.s.0');
  const mask = coatMask(base, coat, 32);
  const cells = mask.flatMap((m, p) => (m ? [p] : []));
  const changed = (out: Uint8ClampedArray) =>
    cells.length
      ? [...Array(32 * 32).keys()].filter((p) =>
          [0, 1, 2, 3].some((c) => out[p * 4 + c] !== coat[p * 4 + c]),
        )
      : [];

  it('finds the cloak below the head', () => expect(cells.length).toBeGreaterThan(80));

  it('dulls and tears only the coat, the same way each time', () => {
    const out = coatLook(base, coat, 32, 'ragged', palette, 7);
    expect(changed(out).every((p) => mask[p])).toBe(true);
    expect(lum(out, cells)).toBeLessThan(lum(coat, cells));
    expect(coatLook(base, coat, 32, 'ragged', palette, 7)).toEqual(out);
  });

  it('gives a fine coat a brass hem and clasp on the palette', () => {
    const out = coatLook(base, coat, 32, 'fine', palette, 7);
    expect(changed(out).every((p) => mask[p])).toBe(true);
    // The hem: each column's lowest coat pixel, all one brass colour from the palette.
    const hem = new Map<number, number>();
    for (const p of cells) hem.set(p % 32, Math.max(hem.get(p % 32) ?? 0, p));
    const colours = new Set(
      [...hem.values()].map((p) => [...out.subarray(p * 4, p * 4 + 3)].join()),
    );
    expect(colours.size).toBe(1);
    expect(palette.some((c) => c.join() === [...colours][0])).toBe(true);
    expect(lum(out, cells)).toBeGreaterThan(lum(coat, cells));
  });
});
