// The selection corners over the tile under the pointer, and the page's tile readout, which is
// told only when the tile or its ground changes, not every frame. View state only.
import type Phaser from 'phaser';
import { TILE } from './frames.ts';

/** What the pointer is over, for the page's readout. */
export interface Hover {
  x: number;
  y: number;
  ground: string;
}

export class HoverMark {
  onHover: (hover: Hover | undefined) => void = () => {};
  private select?: Phaser.GameObjects.Image;
  private last = '';

  /** Makes the corners (`overlay.select` in `sheet`) once the scene's art has loaded. */
  create(scene: Phaser.Scene, sheet: string): void {
    this.select = scene.add
      .image(0, 0, sheet, 'overlay.select')
      .setOrigin(0)
      .setDepth(10)
      .setVisible(false);
  }

  /** Marks and reports the tile under the pointer, or nothing. */
  show(hover: Hover | undefined): void {
    this.select?.setVisible(!!hover).setPosition((hover?.x ?? 0) * TILE, (hover?.y ?? 0) * TILE);
    const key = hover ? `${hover.x},${hover.y},${hover.ground}` : '';
    if (key === this.last) return;
    this.last = key;
    this.onHover(hover);
  }
}

/** The map tile under `pointer` in a map `size` tiles, or undefined off the map. */
export function tileUnder(
  pointer: Phaser.Input.Pointer,
  camera: Phaser.Cameras.Scene2D.Camera,
  size: { width: number; height: number },
): { x: number; y: number } | undefined {
  const world = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
  const x = Math.floor(world.x / TILE);
  const y = Math.floor(world.y / TILE);
  return x >= 0 && y >= 0 && x < size.width && y < size.height ? { x, y } : undefined;
}
