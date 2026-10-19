// Ore stains on the surface (taste board pick, V-087): a speckle of the metal's colour on each
// tile that has ore below it. The speckles come from the tile's position hash, so the same tile
// always shows the same ones, and they are drawn under features, people and goods. The colours
// are content (`features.json` `vein.stainColour`).
import type Phaser from 'phaser';
import { content } from '../content/index.ts';
import { hashAt, TILE } from './frames.ts';

/** Speckles on a stained tile. */
export const SPECKLES = 14;
/** A speckle is 2 to this many pixels wide. */
const BIGGEST = 4;

export interface Speckle {
  x: number;
  y: number;
  size: number;
}

/** The speckles of the stained tile at (x, y), in tile pixels, all inside the tile. */
export function speckles(x: number, y: number): Speckle[] {
  const out: Speckle[] = [];
  let h = hashAt(x, y);
  for (let k = 0; k < SPECKLES; k += 1) {
    h = hashAt(h ^ k, h >>> 9);
    const size = 2 + (h % (BIGGEST - 1));
    out.push({
      x: (h >>> 4) % (TILE - size),
      y: (h >>> 12) % (TILE - size),
      size,
    });
  }
  return out;
}

/** The stain colour of a `stains` value (1 + a features index), as a number, or undefined. */
export function stainColour(stain: number): number | undefined {
  const text = content.features[stain - 1]?.vein?.stainColour;
  return text ? parseInt(text.slice(1), 16) : undefined;
}

/** Draws the surface's stains; redrawn only when the surface's stains change. */
export class StainLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    // Over the ground layers (depth 0), under the features layer (2) and everything drawn on it.
    this.graphics = scene.add.graphics().setDepth(1);
  }

  /** Lays the stains of a `width`-wide surface of `stains` values. */
  set(stains: Uint8Array, width: number): void {
    const g = this.graphics.clear();
    stains.forEach((stain, i) => {
      const colour = stain ? stainColour(stain) : undefined;
      if (colour === undefined) return;
      const [tx, ty] = [i % width, Math.floor(i / width)];
      g.fillStyle(colour, 0.85);
      for (const s of speckles(tx, ty))
        g.fillRect(tx * TILE + s.x, ty * TILE + s.y, s.size, s.size);
    });
  }

  /** Stains show on the surface only. */
  setLevel(z: number): void {
    this.graphics.setVisible(z === 0);
  }
}
