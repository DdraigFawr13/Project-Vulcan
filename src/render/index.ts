// Public surface of the render layer: boots Phaser with the valley scene and hands the page a
// small handle to feed it snapshots and drive the camera.
import Phaser from 'phaser';
import type { ChunkView } from '../worker/index.ts';
import { ValleyScene, type Hover } from './scene.ts';

export type { Hover } from './scene.ts';
export { ZOOMS } from './camera.ts';

export interface Renderer {
  setMapSize(width: number, height: number): void;
  /** Draws changed chunks; ones that arrive before the scene is ready are held until it is. */
  applyChunks(chunks: readonly ChunkView[]): void;
  zoomStep(direction: 1 | -1): void;
  /** Marks the inspected tile, or clears the mark. */
  mark(tile: { x: number; y: number } | undefined): void;
  /** A small picture of the current view as a JPEG data URL, for the save list; '' if none. */
  thumbnail(): Promise<string>;
  /** Frames per second Phaser measured, for the debug readout. */
  fps(): number;
  destroy(): void;
}

export function startRenderer(
  parent: HTMLElement,
  hooks: {
    onHover(hover: Hover | undefined): void;
    onZoom(zoom: number): void;
    onSelect(tile: { x: number; y: number }): void;
  },
): Renderer {
  const scene = new ValleyScene();
  scene.onHover = hooks.onHover;
  scene.onZoom = hooks.onZoom;
  scene.onSelect = hooks.onSelect;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1c1a17',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    // The page owns Space and the number keys (speed); Phaser only reads the pan keys.
    input: { keyboard: { capture: [] } },
    scene: [scene],
  });
  return {
    setMapSize: (width, height) => scene.setMapSize(width, height),
    applyChunks: (chunks) => scene.applyChunks(chunks),
    zoomStep: (direction) => scene.zoomStep(direction),
    mark: (tile) => scene.mark(tile),
    thumbnail: () => thumbnailOf(game),
    fps: () => game.loop.actualFps,
    destroy: () => game.destroy(true),
  };
}

const THUMB = { width: 112, height: 80 };

// The renderer's snapshot, cropped to fill a small frame. A failure or a slow snapshot gives no
// picture rather than holding up the save.
function thumbnailOf(game: Phaser.Game): Promise<string> {
  return new Promise((resolve) => {
    const late = setTimeout(() => resolve(''), 1000);
    const finish = (url: string) => {
      clearTimeout(late);
      resolve(url);
    };
    const draw = (image: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB.width;
      canvas.height = THUMB.height;
      const g = canvas.getContext('2d');
      if (!g || !image.width || !image.height) return finish('');
      const scale = Math.max(THUMB.width / image.width, THUMB.height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      g.drawImage(image, (THUMB.width - w) / 2, (THUMB.height - h) / 2, w, h);
      finish(canvas.toDataURL('image/jpeg', 0.7));
    };
    try {
      game.renderer.snapshot((image) => {
        if (!(image instanceof HTMLImageElement)) return finish('');
        if (image.complete) draw(image);
        else image.onload = () => draw(image);
      });
    } catch {
      finish('');
    }
  });
}
