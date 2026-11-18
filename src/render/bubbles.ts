// Thought bubbles over the map (P6.2, V-154): the person whose sheet is open has their thought
// over their head while it is open; anyone else's shows for SHOW_MS when their thought changes,
// at most OTHERS at once. Bubbles show only at 1x or closer, never under the bar or on top of
// another bubble: one that would meet the bar sits below the head, one that would cover another
// is left out. Paper and ink on the page (hearth-play.css `.bubble`), never a button (V-041):
// view state only, and the words are the worker's.
import Phaser from 'phaser';
import type { WalkerView } from '../worker/index.ts';
import type { Spot } from './finder.ts';

const SHOW_MS = 4000;
const OTHERS = 2;
/** Screen px from the middle of the tile to just over the head (or under the feet), at 1x. */
const HEAD = 18;
const EDGE = 4;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const meets = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export class Bubbles {
  private selected: number | undefined;
  private topInset = 0;
  private clock = 0;
  private readonly thoughts = new Map<number, string>();
  /** Until when (on `clock`) a changed thought shows, by person. */
  private readonly until = new Map<number, number>();
  private readonly layer: HTMLElement;
  private readonly shown = new Map<number, HTMLElement>();

  private readonly scene: Phaser.Scene;
  private readonly spots: () => Spot[];

  constructor(game: Phaser.Game, scene: Phaser.Scene, parent: HTMLElement, spots: () => Spot[]) {
    this.scene = scene;
    this.spots = spots;
    this.layer = document.createElement('div');
    this.layer.className = 'thought-bubbles';
    this.layer.setAttribute('aria-hidden', 'true');
    parent.append(this.layer);
    game.events.on(Phaser.Core.Events.POST_RENDER, () => this.frame(game.loop.delta));
  }

  follow(id: number | undefined): void {
    this.selected = id;
  }

  setTopInset(px: number): void {
    this.topInset = px;
  }

  /** Each snapshot: a thought that changed (after the first one seen) shows for a while. */
  setThoughts(walkers: readonly WalkerView[]): void {
    // Someone gone from the snapshot (dead and buried, or left) is forgotten.
    const here = new Set(walkers.map((w) => w.id));
    for (const id of [...this.thoughts.keys()])
      if (!here.has(id)) [this.thoughts, this.until].forEach((m) => m.delete(id));
    for (const w of walkers) {
      const was = this.thoughts.get(w.id);
      if (was !== undefined && was !== w.thought.text) this.until.set(w.id, this.clock + SHOW_MS);
      this.thoughts.set(w.id, w.thought.text);
    }
  }

  private frame(delta: number): void {
    this.clock += delta;
    const cam = this.scene.cameras.main;
    const near = cam.zoom >= 1;
    const spots = new Map(this.spots().map((s) => [s.id, s]));
    const others = [...this.until]
      .filter(([id, t]) => t > this.clock && id !== this.selected && spots.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, OTHERS)
      .map(([id]) => id);
    const want = near ? [this.selected, ...others].filter((id) => id !== undefined) : [];
    const placed: Box[] = [];
    const keep = new Set<number>();
    const width = this.layer.clientWidth;
    for (const id of want) {
      const at = spots.get(id);
      const text = this.thoughts.get(id);
      if (!at || !text) continue;
      const b = this.bubble(id, text);
      const x = (at.x - cam.worldView.x) * cam.zoom;
      const y = (at.y - cam.worldView.y) * cam.zoom;
      const [w, h] = [b.offsetWidth, b.offsetHeight];
      const left = Math.max(EDGE, Math.min(width - w - EDGE, x - w / 2));
      const above = {
        left,
        right: left + w,
        top: y - HEAD * cam.zoom - h,
        bottom: y - HEAD * cam.zoom,
      };
      const below = {
        left,
        right: left + w,
        top: y + HEAD * cam.zoom,
        bottom: y + HEAD * cam.zoom + h,
      };
      const fits = (r: Box) => r.top >= this.topInset && !placed.some((p) => meets(p, r));
      const spot = fits(above) ? above : fits(below) ? below : undefined;
      if (!spot) {
        b.remove();
        this.shown.delete(id);
        continue;
      }
      placed.push(spot);
      keep.add(id);
      b.classList.toggle('below', spot === below);
      b.style.left = `${spot.left + w / 2}px`;
      b.style.top = `${spot === below ? spot.top : spot.bottom}px`;
    }
    for (const [id, b] of this.shown)
      if (!keep.has(id)) {
        b.remove();
        this.shown.delete(id);
      }
  }

  private bubble(id: number, text: string): HTMLElement {
    let b = this.shown.get(id);
    if (!b) {
      b = document.createElement('div');
      b.className = 'bubble';
      b.dataset['testid'] = 'bubble';
      b.dataset['person'] = String(id);
      this.layer.append(b);
      this.shown.set(id, b);
    }
    if (b.textContent !== text) b.textContent = text;
    return b;
  }
}
