// The burial ground and its graves on the map (P5.8): a hurdle edge round the plot (`burial.hurdle.n|e|s|w`
// on each edge tile of its rectangle, a corner gets two), a dug grave (`grave.dug`) and a filled
// one (`grave.mound`, with `grave.marker` over it when a marker was set), from the `items` sheet.
// Surface only, depth 5 to 6 (over the ground and plans, under items and people). A frame the
// sheet does not have yet is skipped, so nothing breaks while the art lands. Redrawn only when
// the worker's list changes.
import Phaser from 'phaser';
import type { GoodsView } from '../worker/index.ts';
import { ITEMS } from './sheets.ts';

const TILE = 32;
const GROUND = 5;
const STANDING = 6;

export class BurialSprites {
  private graves: GoodsView['graves'] = [];
  private ground: GoodsView['burial'] = [];
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

  set(view: Pick<GoodsView, 'graves' | 'burial'>): void {
    this.graves = view.graves;
    this.ground = view.burial;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(ITEMS)) return;
    const key = `${this.z}:${JSON.stringify([this.graves, this.ground])}`;
    if (key === this.key) return;
    this.key = key;
    for (const s of this.shown) s.destroy();
    this.shown = [];
    if (this.z !== 0) return;
    const sheet = this.scene.textures.get(ITEMS);
    const put = (x: number, y: number, frame: string, depth: number): void => {
      if (!sheet.has(frame)) return;
      this.shown.push(
        this.scene.add
          .image(x * TILE, y * TILE, ITEMS, frame)
          .setOrigin(0)
          .setDepth(depth),
      );
    };
    for (const g of this.graves) {
      if (g.dug) put(g.x, g.y, 'grave.dug', GROUND);
      else {
        put(g.x, g.y, 'grave.mound', GROUND);
        if (g.marker) put(g.x, g.y, 'grave.marker', STANDING);
      }
    }
    for (const r of this.ground)
      for (let y = r.y; y < r.y + r.h; y += 1)
        for (let x = r.x; x < r.x + r.w; x += 1) {
          if (y === r.y) put(x, y, 'burial.hurdle.n', STANDING);
          if (y === r.y + r.h - 1) put(x, y, 'burial.hurdle.s', STANDING);
          if (x === r.x) put(x, y, 'burial.hurdle.w', STANDING);
          if (x === r.x + r.w - 1) put(x, y, 'burial.hurdle.e', STANDING);
        }
  }
}
