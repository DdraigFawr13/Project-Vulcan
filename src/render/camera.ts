// Camera controls: drag to pan, wheel or pinch to zoom smoothly, the +/− buttons and keys to glide
// a step in or out, WASD and arrow keys to pan. Zoomed all the way out, the whole map fits on
// screen. The view never leaves the map. View state only.
import Phaser from 'phaser';

/** Closest zoom. Below 1× the tiles are smaller than the 32 px rule (VR-37): an overview only. */
export const MAX_ZOOM = 3;
/** The farthest zoom when the whole map already fits at a closer one. */
const MIN_ZOOM = 0.25;
/** One press of +, − or a zoom key glides this far in or out (Morgan, 2026-10-18: the old fixed
 * steps jumped too far). */
const BUTTON_STEP = 1.5;
/** Wheel zoom per pixel of scroll: a usual mouse notch (100 px) is about 14%. */
const WHEEL_RATE = 0.0015;
/** How quickly a button glide closes on its target: the share of the gap left after 100 ms. */
const GLIDE_LEFT = 0.1;
const PAN_SPEED = 900; // screen px per second for keys
const DRAG_THRESHOLD = 6; // px a press moves before it counts as a drag, not a tap

export class CameraControls {
  dragging = false;
  private zoom = 1;
  /** Where a button glide is heading, or undefined when none is under way. */
  private target: number | undefined;
  /** The farthest zoom: the whole map on screen, or MIN_ZOOM if that is farther still. */
  private min = MIN_ZOOM;
  private mapSize = { width: 0, height: 0 };
  /** Screen px along the top covered by the page's bar: the map is fitted and scrolled clear of it. */
  private top = 0;
  /** Finger spread and zoom when a pinch began. */
  private pinchBase = 0;
  private pinchZoom = 1;
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
    input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy === 0) return;
      this.target = undefined;
      // Clamped so one fast flick of a trackpad cannot leap across the whole range.
      const factor = Math.pow(1 + WHEEL_RATE, -Math.max(-300, Math.min(300, dy)));
      this.zoomTo(this.zoom * factor, p.x, p.y);
    });
    // A turned phone or a resized window changes what fits.
    scene.scale.on('resize', (size: Phaser.Structs.Size) => this.refit(size));
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
    this.refit();
    this.camera.centerOn(width / 2, height / 2);
  }

  /** The bar over the top of the view is `px` tall; refits so no map row hides under it. */
  setTopInset(px: number): void {
    if (px === this.top) return;
    this.top = px;
    this.refit();
  }

  /** Centres the view on map point (x, y), in the part of the screen below the bar. */
  lookAt(x: number, y: number): void {
    this.target = undefined;
    this.camera.centerOn(x, y - this.top / 2 / this.zoom);
  }

  /** Glides one step in (1) or out (-1) about the middle of the screen. */
  zoomStep(direction: 1 | -1): void {
    const from = this.target ?? this.zoom;
    this.target = this.clamp(from * BUTTON_STEP ** direction);
  }

  update(delta: number): void {
    if (this.target !== undefined) {
      const left = GLIDE_LEFT ** (delta / 100);
      const next = this.target + (this.zoom - this.target) * left;
      // Close enough to land: under half a percent away.
      const done = Math.abs(next - this.target) < this.target * 0.005;
      this.zoomTo(done ? this.target : next, this.camera.width / 2, this.camera.height / 2);
      if (done) this.target = undefined;
    }
    const k = this.keys;
    const dx = +!!(k.D?.isDown || k.RIGHT?.isDown) - +!!(k.A?.isDown || k.LEFT?.isDown);
    const dy = +!!(k.S?.isDown || k.DOWN?.isDown) - +!!(k.W?.isDown || k.UP?.isDown);
    if (dx || dy) {
      const step = (PAN_SPEED * delta) / 1000 / this.camera.zoom;
      this.camera.scrollX += dx * step;
      this.camera.scrollY += dy * step;
    }
  }

  private clamp(zoom: number): number {
    return Math.min(MAX_ZOOM, Math.max(this.min, zoom));
  }

  /** Sets the zoom, keeping the map point under screen point (sx, sy) where it is. Phaser zooms
   * about the camera's middle, so the world x at screen x is scrollX + w/2 + (sx - w/2) / zoom. */
  private zoomTo(zoom: number, sx: number, sy: number): void {
    const next = this.clamp(zoom);
    const cam = this.camera;
    cam.scrollX += (sx - cam.width / 2) * (1 / this.zoom - 1 / next);
    cam.scrollY += (sy - cam.height / 2) * (1 / this.zoom - 1 / next);
    this.zoom = next;
    this.applyZoom();
  }

  // A map smaller than the view on a side gets bounds widened evenly on that side, so it sits in
  // the middle of the screen instead of the top left. The bounds also reach the bar's height above
  // the map, so the top row can always be scrolled out from under the bar.
  private applyZoom(view: { width: number; height: number } = this.camera): void {
    const zoom = this.zoom;
    const { width, height } = this.mapSize;
    const inset = this.top / zoom;
    const w = Math.max(width, view.width / zoom);
    const h = Math.max(height + inset, view.height / zoom);
    this.camera.setBounds((width - w) / 2, (height - inset - h) / 2, w, h).setZoom(zoom);
  }

  // Works out the farthest zoom (the whole map below the bar), keeping a fitted view fitted
  // across a resize.
  private refit(view: { width: number; height: number } = this.camera): void {
    const { width, height } = this.mapSize;
    if (!width || !height) return;
    const fitted = this.zoom <= this.min * 1.001;
    const fit = Math.min(view.width / width, (view.height - this.top) / height);
    this.min = Math.min(fit, MIN_ZOOM);
    this.zoom = fitted ? this.min : this.clamp(this.zoom);
    if (this.target !== undefined) this.target = this.clamp(this.target);
    this.applyZoom(view);
  }

  private move(p: Phaser.Input.Pointer): void {
    const input = this.scene.input;
    const a = input.pointer1;
    const b = input.pointer2;
    if (a?.isDown && b?.isDown) {
      // A pinch follows the fingers: the zoom scales with their spread, about their midpoint.
      const spread = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      this.dragging = true;
      this.target = undefined;
      if (!this.pinchBase) {
        this.pinchBase = spread;
        this.pinchZoom = this.zoom;
      } else if (spread > 0)
        this.zoomTo((this.pinchZoom * spread) / this.pinchBase, (a.x + b.x) / 2, (a.y + b.y) / 2);
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
