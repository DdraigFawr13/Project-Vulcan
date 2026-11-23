// Unseen surface (6W Slice 6, V-213): land nobody has seen draws faded, like an unfinished map.
// Its ground and water tiles draw at `FADE` over a sheet of the page colour laid under the
// surface, so the lie of the land shows (river, grass, rock, snow) and nothing on it (the worker
// sends no features or prints there). Below ground unknown rock stays black (V-030).
import type Phaser from 'phaser';
import { TILE } from './frames.ts';

/** How much of an unseen tile's own picture shows over the page. */
export const FADE = 0.33;

/** The page colour token (docs/UI_STYLE.md), read from CSS, as `#rrggbb`. */
export const pageHex = (): string =>
  getComputedStyle(document.documentElement).getPropertyValue('--page').trim() || '#ded0b0';

/** The page-coloured sheet under the surface's tiles, shown with them on the surface only. */
export class Backdrop {
  private readonly rect: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.rect = scene.add
      .rectangle(0, 0, 1, 1, parseInt(pageHex().slice(1), 16))
      .setOrigin(0)
      .setDepth(-1)
      .setVisible(false);
  }

  setMapSize(width: number, height: number): void {
    this.rect.setScale(width * TILE, height * TILE);
  }

  show(on: boolean): void {
    this.rect.setVisible(on);
  }
}
