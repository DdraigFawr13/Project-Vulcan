// Camera controls: drag to pan, wheel or pinch to zoom on fixed steps, WASD and arrow keys to
// pan. The lowest step fits the whole map on screen. The view never leaves the map. View state only.
import Phaser from 'phaser';

/**
 * Fixed zoom steps. Below 1× the tiles are smaller than the 32 px rule (VR-37): those steps are
 * an overview only. Under the smallest one sits a step that fits the whole map on screen.
 */
export const ZOOMS = [0.25, 0.5, 1, 2, 3] as const;
const PAN_SPEED = 900; // screen px per second for keys
const DRAG_THRESHOLD = 6; // px a press moves before it counts as a drag, not a tap
const PINCH_STEP = 1.3; // finger spread ratio that changes one zoom step

export class CameraControls {
  dragging = false;
  /** The steps in use: `ZOOMS`, led by the zoom that fits the map when that is smaller. */
  private steps: number[] = [...ZOOMS];
  private zoomIndex = ZOOMS.indexOf(1);
  private mapSize = { width: 0, height: 0 };
  /** Screen px along the top covered by the page's bar: the map is fitted and scrolled clear of it. */
  private top = 0;
  private pinchBase = 0;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
    // A turned phone or a resized window changes what fits.
    scene.scale.on('resize', (size: Phaser.Structs.Size) => this.fitSteps(size));
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
    this.mapSize = { width, height };
    this.fitSteps();
    this.camera.centerOn(width / 2, height / 2);
  }

  /** The bar over the top of the view is `px` tall; refits so no map row hides under it. */
  setTopInset(px: number): void {
    if (px === this.top) return;
    this.top = px;
    this.fitSteps();
  }

  zoomStep(direction: 1 | -1): void {
    const next = Math.min(Math.max(this.zoomIndex + direction, 0), this.steps.length - 1);
    if (next === this.zoomIndex) return;
    this.zoomIndex = next;
    this.applyZoom();
  }

  // A map smaller than the view on a side gets bounds widened evenly on that side, so it sits in
  // the middle of the screen instead of the top left. The bounds also reach the bar's height above
  // the map, so the top row can always be scrolled out from under the bar.
  private applyZoom(view: { width: number; height: number } = this.camera): void {
    const zoom = this.steps[this.zoomIndex]!;
    const { width, height } = this.mapSize;
    const inset = this.top / zoom;
    const w = Math.max(width, view.width / zoom);
    const h = Math.max(height + inset, view.height / zoom);
    const { midPoint } = this.camera;
    this.camera
      .setBounds((width - w) / 2, (height - inset - h) / 2, w, h)
      .setZoom(zoom)
      .centerOn(midPoint.x, midPoint.y);
  }

  // Adds the whole-map step when the map does not fit at the smallest fixed step, keeping the
  // current step (or the fit step, if the view was fitted) across a resize.
  private fitSteps(view: { width: number; height: number } = this.camera): void {
    const { width, height } = this.mapSize;
    if (!width || !height) return;
    const fitted = this.steps.length > ZOOMS.length && this.zoomIndex === 0;
    const current = this.steps[this.zoomIndex]!;
    const fit = Math.min(view.width / width, (view.height - this.top) / height);
    this.steps = fit < ZOOMS[0] ? [fit, ...ZOOMS] : [...ZOOMS];
    this.zoomIndex = fitted ? 0 : Math.max(this.steps.indexOf(current), 0);
    this.applyZoom(view);
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
