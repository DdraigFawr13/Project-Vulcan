// Fields on the map (P4.7): ploughed furrows from the `buildings` sheet, one frame a tile, under
// everything that stands or lies on them. The furrows run on across neighbouring tiles with no
// edge, so a field takes the shape of the good soil it was laid on (the taste board's pick). The
// worker names each tile's frame (planned, sown, ripe by crop, fallow); this only draws them.
// Redrawn only when what the surface shows has changed.
import Phaser from 'phaser';
import type { GoodsView } from '../worker/index.ts';
import { BUILDINGS } from './sheets.ts';

const TILE = 32;
// Above the ground and the shore, under plans (4), items (6) and people (8).
const DEPTH = 3;

export class FieldSprites {
  private fields: GoodsView['fields'] = [];
  private width = 0;
  private shown: Phaser.GameObjects.Image[] = [];
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

  setMapSize(width: number): void {
    this.width = width;
    this.key = '';
  }

  set(fields: GoodsView['fields']): void {
    this.fields = fields;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  private draw(): void {
    if (!this.live || !this.width || !this.scene.textures.exists(BUILDINGS)) return;
    const key = `${this.z}:${this.width}:${JSON.stringify(this.fields)}`;
    if (key === this.key) return;
    this.key = key;
    for (const s of this.shown) s.destroy();
    this.shown = [];
    if (this.z !== 0) return;
    const sheet = this.scene.textures.get(BUILDINGS);
    for (const { frame, tiles } of this.fields) {
      if (!sheet.has(frame)) continue;
      for (const i of tiles)
        this.shown.push(
          this.scene.add
            .image((i % this.width) * TILE, Math.floor(i / this.width) * TILE, BUILDINGS, frame)
            .setOrigin(0)
            .setDepth(DEPTH),
        );
    }
  }
}
