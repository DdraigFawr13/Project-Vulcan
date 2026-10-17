// Camera controls: drag to pan, wheel or pinch to zoom on fixed steps, WASD and arrow keys to
// pan. The view never leaves the map. View state only.
import Phaser from 'phaser';

/** Zoom steps. ½× shows 16 px tiles, below the 32 px rule, as an overview only. */
export const ZOOMS = [0.5, 1, 2, 3] as const;
const PAN_SPEED = 900; // screen px per second for keys
const DRAG_THRESHOLD = 6; // px a press moves before it counts as a drag, not a tap
const PINCH_STEP = 1.3; // finger spread ratio that changes one zoom step

export class CameraControls {
  dragging = false;
  private zoomIndex = 1;
  private pinchBase = 0;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private readonly scene: Phaser.Scene;
  private readonly onZoom: (zoom: number) => void;

  constructor(scene: Phaser.Scene, onZoom: (zoom: number) => void) {
    this.scene = scene;
    this.onZoom = onZoom;
    const input = scene.input;
    input.addPointer(1);
    input.on('pointerdown', () => {
      this.dragging = false;
      this.pinchBase = 0;
    });
    input.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    input.on('pointerup', () => {
      // Let the release's own hover check run before the drag flag clears.
      scene.time.delayedCall(0, () => (this.dragging = false));
    });
    input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.zoomStep(dy > 0 ? -1 : 1);
    });
    const keyboard = input.keyboard;
    if (keyboard)
      for (const name of ['W', 'A', 'S', 'D', 'UP', 'LEFT', 'DOWN', 'RIGHT'])
        this.keys[name] = keyboard.addKey(name, false);
  }

  get camera(): Phaser.Cameras.Scene2D.Camera {
    return this.scene.cameras.main;
  }

  /** Bounds the camera to the map and centres it there at the current zoom. */
  frameMap(width: number, height: number): void {
    this.camera.setBounds(0, 0, width, height).setZoom(ZOOMS[this.zoomIndex]);
    this.camera.centerOn(width / 2, height / 2);
    this.onZoom(this.camera.zoom);
  }

  zoomStep(direction: 1 | -1): void {
    const next = Math.min(Math.max(this.zoomIndex + direction, 0), ZOOMS.length - 1);
    if (next === this.zoomIndex) return;
    const { midPoint } = this.camera;
    this.zoomIndex = next;
    this.camera.setZoom(ZOOMS[next]).centerOn(midPoint.x, midPoint.y);
    this.onZoom(this.camera.zoom);
  }

  update(delta: number): void {
    const k = this.keys;
    const dx = +!!(k.D?.isDown || k.RIGHT?.isDown) - +!!(k.A?.isDown || k.LEFT?.isDown);
    const dy = +!!(k.S?.isDown || k.DOWN?.isDown) - +!!(k.W?.isDown || k.UP?.isDown);
    if (dx || dy) {
      const step = (PAN_SPEED * delta) / 1000 / this.camera.zoom;
      this.camera.scrollX += dx * step;
      this.camera.scrollY += dy * step;
    }
  }

  private move(p: Phaser.Input.Pointer): void {
    const input = this.scene.input;
    const a = input.pointer1;
    const b = input.pointer2;
    if (a?.isDown && b?.isDown) {
      const spread = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      this.dragging = true;
      if (!this.pinchBase) this.pinchBase = spread;
      else if (spread / this.pinchBase > PINCH_STEP || this.pinchBase / spread > PINCH_STEP) {
        this.zoomStep(spread > this.pinchBase ? 1 : -1);
        this.pinchBase = spread;
      }
      return;
    }
    if (!p.isDown) return;
    if (!this.dragging && Phaser.Math.Distance.Between(p.downX, p.downY, p.x, p.y) < DRAG_THRESHOLD)
      return;
    this.dragging = true;
    this.camera.scrollX -= (p.x - p.prevPosition.x) / this.camera.zoom;
    this.camera.scrollY -= (p.y - p.prevPosition.y) / this.camera.zoom;
  }
}
