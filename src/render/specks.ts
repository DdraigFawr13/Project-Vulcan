// What flies from work (V-194, Morgan's Q2 B): specks 3 px with a dark edge thrown at each strike
// and falling (chips, grit, clods, sparks), rising puffs that fade (steam, smoke, flour dust) and
// slow drifts (a thread, a bee), in each job's own colours from jobs.json `effect`. Drawn in world
// pixels on one graphics layer just over the people. A picture choice only.
import Phaser from 'phaser';
import type { ActView } from '../worker/index.ts';

type Effect = NonNullable<ActView['effect']>;

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  colour: number;
  t: number;
  life: number;
  size: number;
  edge: boolean;
  fade: boolean;
}

/** Seconds a speck lasts, its size, and its dark edge (Q2 B). */
const SPECK = { life: 0.85, size: 3 };
const EDGE = 0x1a110b;
/** At most this many bits at once, so a crowded yard stays cheap. */
const MOST = 400;

const hex = (c: string): number => Number.parseInt(c.slice(1), 16);

export class Specks {
  private bits: Bit[] = [];
  private seed = 7;
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(8.4);
  }

  /** A seeded roll, so the same strike looks the same in a still picture. */
  private roll(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** One strike's worth of `effect` from world spot (x, y), thrown towards `dir` (1 east, -1
   * west) and up at `up` px a second. */
  throw(effect: Effect, x: number, y: number, dir: number, up: number): void {
    const colours = effect.colours.map(hex);
    for (let i = 0; i < effect.count && this.bits.length < MOST; i++) {
      const colour = colours[i % colours.length] ?? 0xffffff;
      const r = () => this.roll();
      if (effect.kind === 'specks')
        this.bits.push({
          x,
          y,
          vx: dir * (10 + r() * 30) + (r() - 0.5) * 20,
          vy: -up - r() * 35,
          g: 150,
          colour,
          t: 0,
          life: SPECK.life,
          size: SPECK.size,
          edge: true,
          fade: false,
        });
      else if (effect.kind === 'puff')
        this.bits.push({
          x: x + (r() - 0.5) * 8,
          y: y - i * 2,
          vx: (r() - 0.5) * 4,
          vy: -10 - r() * 6,
          g: 0,
          colour,
          t: 0,
          life: SPECK.life * 2.2,
          size: SPECK.size + 1,
          edge: false,
          fade: true,
        });
      else
        this.bits.push({
          x: x + (r() - 0.5) * 6,
          y: y + (r() - 0.5) * 6,
          vx: dir * (6 + r() * 8),
          vy: -4 - r() * 4,
          g: 8,
          colour,
          t: 0,
          life: 1.6,
          size: 2,
          edge: true,
          fade: true,
        });
    }
  }

  /** Moves every bit `dt` seconds on and draws them; `dt` 0 (paused) only draws. */
  step(dt: number): void {
    for (const b of this.bits) {
      b.t += dt;
      b.vy += b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bits = this.bits.filter((b) => b.t < b.life);
    const g = this.g.clear();
    for (const b of this.bits) {
      const alpha = b.fade ? Math.max(0, 1 - b.t / b.life) : 1;
      const [x, y] = [Math.round(b.x), Math.round(b.y)];
      if (b.edge) g.fillStyle(EDGE, alpha).fillRect(x + 1, y + 1, b.size, b.size);
      g.fillStyle(b.colour, alpha).fillRect(x, y, b.size, b.size);
    }
  }

  /** How many bits are in the air (the browser check reads it). */
  get count(): number {
    return this.bits.length;
  }
}
