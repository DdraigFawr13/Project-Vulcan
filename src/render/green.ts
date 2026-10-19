// The green and the names of planned houses (P3.7, V-050): the green is where the cart first
// stopped, shown as a dashed ring of trodden grass about three tiles out, and a house still
// planned is named above it, a label that goes once it stands. Plans themselves stay the faint
// picture build.ts draws. Pictures only: where and what come from the snapshot's `BuildView`.
import Phaser from 'phaser';
import type { BuildView } from '../worker/index.ts';

const TILE = 32;
/** The ring's radius in tiles, and how many dashes make it. */
const RADIUS = 3;
const DASHES = 14;
// Above the buildings (4 to 6) and the people (8), under the selection mark (10).
const RING_DEPTH = 3;
const LABEL_DEPTH = 9;

/** A colour the page's tokens define, as a number Phaser takes. */
const token = (name: string): number =>
  Phaser.Display.Color.HexStringToColor(
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#efe2c2',
  ).color;

export class GreenSprites {
  private view: BuildView | undefined;
  private shown: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private key = '';
  private z = 0;
  private live = false;

  private readonly scene: Phaser.Scene;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.draw();
      }),
    );
  }

  set(view: BuildView): void {
    this.view = view;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  private draw(): void {
    const view = this.view;
    if (!this.live || !view) return;
    const planned = view.houses.filter((h) => h.state === 'plan');
    const key = JSON.stringify([this.z, view.green, planned]);
    if (key === this.key) return;
    this.key = key;
    for (const s of this.shown) s.destroy();
    this.shown = [];
    if (this.z !== 0) return;
    const [cx, cy] = [(view.green.x + 0.5) * TILE, (view.green.y + 0.5) * TILE];
    const ring = this.scene.add.graphics().setDepth(RING_DEPTH);
    const grass = token('--bone-soft');
    ring.fillStyle(grass, 0.12).fillCircle(cx, cy, RADIUS * TILE);
    ring.lineStyle(3, grass, 0.85);
    const step = (Math.PI * 2) / DASHES;
    for (let i = 0; i < DASHES; i += 1) {
      ring.beginPath();
      ring.arc(cx, cy, RADIUS * TILE, i * step, (i + 0.6) * step);
      ring.strokePath();
    }
    this.shown.push(ring, this.label('the green', cx, cy + (RADIUS + 0.1) * TILE, 0));
    for (const h of planned)
      this.shown.push(this.label(`${h.name} (planned)`, (h.x + h.w / 2) * TILE, h.y * TILE - 4, 1));
  }

  /** A label in the page's reading face, bone with an oak-dark edge; `up` 1 sits above its point. */
  private label(text: string, x: number, y: number, up: 0 | 1): Phaser.GameObjects.Text {
    const style = getComputedStyle(document.documentElement);
    const css = (name: string) => style.getPropertyValue(name).trim();
    return this.scene.add
      .text(x, y, text, {
        fontFamily: css('--read') || 'Georgia, serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: css('--bone') || '#efe2c2',
        stroke: css('--oak-dark') || '#1a110b',
        strokeThickness: 4,
        resolution: 2,
      })
      .setOrigin(0.5, up)
      .setDepth(LABEL_DEPTH);
  }
}
