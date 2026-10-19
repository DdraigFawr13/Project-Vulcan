// The build progress bar (P3.6, Morgan 2026-10-19): over every plan, part or piece someone is
// working on, a thin bar a little under a tile wide just above the tile: dark iron track, ember
// fill, a 1 px oak edge. The worker sends minutes done and the total with each snapshot; the
// fill glides between snapshots at the sim speed (paused it holds still), easing towards the
// latest value and only ever going forward, except when the total changes (a new job or a reset).
import Phaser from 'phaser';
import { TICKS_PER_SECOND, type GoodsView, type Speed } from '../worker/index.ts';
import { advance, reconcile, type Bar } from './progress-math.ts';

const TILE = 32;
/** The bar's size in art pixels: a track 24 wide and 4 tall inside a 1 px edge. */
const WIDTH = 24;
const HEIGHT = 4;
// Over the people (8) and the night (8.5, 8.6); under the selection marks (10).
const DEPTH = 9.5;

/** A colour the page's tokens define, as a number Phaser takes. */
const token = (name: string, fallback: string): number =>
  Phaser.Display.Color.HexStringToColor(
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback,
  ).color;

export class WorkBars {
  private bars = new Map<string, Bar>();
  private speed: Speed = 0;
  private z = 0;
  private live = false;
  private graphics: Phaser.GameObjects.Graphics | undefined;
  private colours = { edge: 0, track: 0, fill: 0, tip: 0 };

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        const ember = Phaser.Display.Color.ValueToColor(token('--ember', '#c8743a'));
        this.colours = {
          edge: token('--oak', '#4a3322'),
          track: Phaser.Display.Color.ValueToColor(token('--iron', '#5c5e5e')).darken(40).color,
          fill: ember.color,
          tip: ember.clone().lighten(25).color,
        };
        this.graphics = scene.add.graphics().setDepth(DEPTH);
        scene.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
          this.update(delta / 1000),
        );
      }),
    );
  }

  /** The snapshot's bars and the speed the sim runs at (a skip counts as the fastest). */
  set(work: GoodsView['work'], speed: Speed): void {
    this.speed = speed;
    this.bars = reconcile(this.bars, work);
  }

  setLevel(z: number): void {
    this.z = z;
  }

  private update(dt: number): void {
    const g = this.graphics;
    if (!g || !this.live) return;
    g.clear();
    const rate = TICKS_PER_SECOND[this.speed];
    for (const bar of this.bars.values()) {
      advance(bar, dt, rate);
      if (bar.z !== this.z) continue;
      this.draw(g, bar);
    }
  }

  private draw(g: Phaser.GameObjects.Graphics, bar: Bar): void {
    const [x, y] = [bar.x * TILE + (TILE - WIDTH) / 2, bar.y * TILE - HEIGHT - 3];
    // Fractional widths keep the glide smooth at any zoom.
    const filled = Math.min(1, bar.shown / bar.total) * WIDTH;
    g.fillStyle(this.colours.edge).fillRect(x - 1, y - 1, WIDTH + 2, HEIGHT + 2);
    g.fillStyle(this.colours.track).fillRect(x, y, WIDTH, HEIGHT);
    if (filled <= 0) return;
    g.fillStyle(this.colours.fill).fillRect(x, y, filled, HEIGHT);
    g.fillStyle(this.colours.tip).fillRect(x, y, filled, 1);
  }
}
