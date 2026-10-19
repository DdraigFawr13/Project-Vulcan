// Night and firelight (P3.6; Morgan's taste-board pick: "warmth shows as firelight at night"). The
// surface dims after dusk to a deep blue-grey, and each lit fire is a soft warm pool of light on
// it, as wide as the fire's reach (its room's tiles indoors, else its radius; roofs are never
// drawn, so the pool simply lies over the room), dimmer when banked. One image per lit fire,
// rebuilt only when the set of fires changes; the dusk and dawn only move the alphas. Pictures
// only: where and how far come from the snapshot, the hour from its clock.
import Phaser from 'phaser';
import type { ClockView, GoodsView } from '../worker/index.ts';

const TILE = 32;
const GLOW = 'firelight.glow';
// Over the people (8), under the green's labels (9) and the bars (9.5).
const SHADE_DEPTH = 8.5;
const GLOW_DEPTH = 8.6;
/** How dark the night gets (0 to 1 alpha), and the hours dusk and dawn run between. */
const NIGHT_ALPHA = 0.6;
const DUSK = [19, 21] as const;
const DAWN = [5, 7] as const;
/** A banked fire's glow against a burning one's, and the flicker's size and speed. */
const BANKED = 0.4;
const FLICKER = 0.07;

/** How far into night the clock is, 0 (day) to 1 (dark), easing through dusk and dawn. */
export function nightOf(clock: Pick<ClockView, 'hour' | 'minute'>): number {
  const h = clock.hour + clock.minute / 60;
  const ramp = (a: number, b: number) => Phaser.Math.Clamp((h - a) / (b - a), 0, 1);
  const t = h >= 12 ? ramp(...DUSK) : 1 - ramp(...DAWN);
  return t * t * (3 - 2 * t);
}

/** A colour the page's tokens define, as a number Phaser takes. */
const token = (name: string, fallback: string): number =>
  Phaser.Display.Color.HexStringToColor(
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback,
  ).color;

export class Firelight {
  private fires: GoodsView['fires'] = [];
  private pools: { image: Phaser.GameObjects.Image; banked: boolean; phase: number }[] = [];
  private shade: Phaser.GameObjects.Graphics | undefined;
  private key = '';
  private night = 0;
  private size = { width: 0, height: 0 };
  private z = 0;
  private live = false;

  private readonly scene: Phaser.Scene;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.glowTexture();
        scene.events.on(Phaser.Scenes.Events.UPDATE, (time: number) => this.flicker(time));
        this.draw();
      }),
    );
  }

  setMapSize(width: number, height: number): void {
    this.size = { width, height };
    this.shade?.destroy();
    this.shade = undefined;
    this.draw();
  }

  set(fires: GoodsView['fires'], clock: ClockView): void {
    this.fires = fires;
    this.night = nightOf(clock);
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  /** A white disc that fades to nothing at its edge, tinted per use. */
  private glowTexture(): void {
    if (this.scene.textures.exists(GLOW)) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d')!;
    const fade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    fade.addColorStop(0, 'rgba(255,255,255,0.9)');
    fade.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    fade.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, 128, 128);
    this.scene.textures.addCanvas(GLOW, canvas);
  }

  private draw(): void {
    if (!this.live) return;
    const surface = this.z === 0;
    if (!this.shade && this.size.width) {
      this.shade = this.scene.add
        .graphics()
        .fillStyle(0x242832)
        .fillRect(0, 0, this.size.width * TILE, this.size.height * TILE)
        .setDepth(SHADE_DEPTH);
    }
    // Night is an above-ground sky: underground and by day there is nothing to draw.
    this.shade?.setVisible(surface && this.night > 0).setAlpha(this.night * NIGHT_ALPHA);
    const key = JSON.stringify([surface, this.fires]);
    if (key !== this.key) {
      this.key = key;
      for (const p of this.pools) p.image.destroy();
      this.pools = [];
      const tint = token('--ember', '#c8743a');
      if (surface)
        for (const f of this.fires)
          this.pools.push({
            image: this.scene.add
              .image((f.x + 0.5) * TILE, (f.y + 0.5) * TILE, GLOW)
              .setDisplaySize(f.radius * 2 * TILE, f.radius * 2 * TILE)
              .setTint(tint)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(GLOW_DEPTH),
            banked: f.banked,
            phase: f.x * 1.7 + f.y * 2.9,
          });
    }
    this.flicker(this.scene.time.now);
  }

  /** Each pool's alpha: the night's strength, dimmer banked, with a slow shimmer. */
  private flicker(time: number): void {
    for (const p of this.pools) {
      const shimmer = 1 + FLICKER * Math.sin(time / 230 + p.phase) * Math.sin(time / 97 + p.phase);
      p.image.setVisible(this.night > 0).setAlpha(this.night * (p.banked ? BANKED : 1) * shimmer);
    }
  }
}
