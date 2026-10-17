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
  /** Frames per second Phaser measured, for the debug readout. */
  fps(): number;
  destroy(): void;
}

export function startRenderer(
  parent: HTMLElement,
  hooks: { onHover(hover: Hover | undefined): void; onZoom(zoom: number): void },
): Renderer {
  const scene = new ValleyScene();
  scene.onHover = hooks.onHover;
  scene.onZoom = hooks.onZoom;
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
    fps: () => game.loop.actualFps,
    destroy: () => game.destroy(true),
  };
}
