// Shaft plans on the map (Bundle 2): the shaft's own ground art at half opacity on a tile where a
// shaft is planned or being sunk, like the other plans. Once it is sunk the chunk's tile shows the
// shaft itself. The worker lists the tiles; this only draws them, and only when they change.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { GoodsView } from '../worker/index.ts';

const TILE = 32;
const SHEET = 'tiles-world';
// With the other plans (floors, stairs), above the ground and under items and people.
const DEPTH = 4;
const ALPHA = 0.5;

export class ShaftSprites {
  private shafts: GoodsView['shafts'] = [];
  private shown: Phaser.GameObjects.Image[] = [];
  private key = '';
  private z = 0;
  private live = false;

  private readonly scene: Phaser.Scene;
  private readonly frame = `${content.terrain.kinds.find((k) => k.id === content.terrain.generator.underground.shaft)?.art ?? 'tile.shaft'}.1`;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.draw();
      }),
    );
  }

  set(shafts: GoodsView['shafts']): void {
    this.shafts = shafts;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(SHEET)) return;
    const key = `${this.z}:${JSON.stringify(this.shafts)}`;
    if (key === this.key) return;
    this.key = key;
    for (const s of this.shown) s.destroy();
    this.shown = [];
    if (this.z !== 0 || !this.scene.textures.get(SHEET).has(this.frame)) return;
    for (const { x, y } of this.shafts)
      this.shown.push(
        this.scene.add
          .image(x * TILE, y * TILE, SHEET, this.frame)
          .setOrigin(0)
          .setDepth(DEPTH)
          .setAlpha(ALPHA),
      );
  }
}
