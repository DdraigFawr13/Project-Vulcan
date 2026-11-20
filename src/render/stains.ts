// Ore stains on the surface (taste board pick, V-087): a speckle of the metal's colour on each
// tile that has ore below it. The speckles come from the tile's position hash, so the same tile
// always shows the same ones, and they are drawn under features, people and goods. The colours
// are content (`features.json` `vein.stainColour`).
import type Phaser from 'phaser';
import { content } from '../content/index.ts';
import { hashAt, TILE } from './frames.ts';
import type { Area } from './tile-window.ts';

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

/** Draws the surface's stains inside the window near the camera (tile-window.ts); redrawn only
 * when the surface's stains change or the window moves. */
export class StainLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private stains: Uint8Array = new Uint8Array(0);
  private width = 0;
  private area: Area = { x: 0, y: 0, w: 0, h: 0 };
  private surface = true;
  private shown = true;

  constructor(scene: Phaser.Scene) {
    // Over the ground layers (depth 0), under the features layer (2) and everything drawn on it.
    this.graphics = scene.add.graphics().setDepth(1);
  }

  /** Lays the stains of a `width`-wide surface of `stains` values. */
  set(stains: Uint8Array, width: number): void {
    this.stains = stains;
    this.width = width;
    this.draw();
  }

  /** The window moved. */
  place(area: Area): void {
    this.area = area;
    this.draw();
  }

  private draw(): void {
    const g = this.graphics.clear();
    const { x: ax, y: ay, w, h } = this.area;
    const height = this.width ? this.stains.length / this.width : 0;
    for (let ty = ay; ty < Math.min(height, ay + h); ty += 1)
      for (let tx = ax; tx < Math.min(this.width, ax + w); tx += 1) {
        const stain = this.stains[ty * this.width + tx]!;
        const colour = stain ? stainColour(stain) : undefined;
        if (colour === undefined) continue;
        g.fillStyle(colour, 0.85);
        for (const s of speckles(tx, ty))
          g.fillRect(tx * TILE + s.x, ty * TILE + s.y, s.size, s.size);
      }
  }

  /** Stains show on the surface only. */
  setLevel(z: number): void {
    this.surface = z === 0;
    this.graphics.setVisible(this.surface && this.shown);
  }

  /** Hidden under the overview picture. */
  show(on: boolean): void {
    this.shown = on;
    this.graphics.setVisible(this.surface && this.shown);
  }
}
