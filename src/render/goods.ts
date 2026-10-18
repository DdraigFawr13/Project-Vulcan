// Goods on the map (P2.4): the store's tiles, the items lying about and, in test mode, the marks
// on trees, all from the `items` sheet. Each snapshot carries them; the layer is redrawn only
// when what lies on the level on screen has changed.
import Phaser from 'phaser';
import type { GoodsView } from '../worker/index.ts';

export const ITEMS = 'items';
const TILE = 32;

export class GoodsSprites {
  private view: GoodsView = { items: [], store: [], marks: [], plans: [] };
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

  set(view: GoodsView): void {
    this.view = view;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(ITEMS)) return;
    const here = <T extends { z: number }>(list: readonly T[]) =>
      list.filter((s) => s.z === this.z);
    // Under the people (depth 8), store tiles first, then what lies on them, then the marks.
    const layers: [string, { x: number; y: number }[], number][] = [
      ['zone.stockpile', here(this.view.store), 5],
      ...here(this.view.items).map((i): [string, { x: number; y: number }[], number] => [
        i.frame,
        [i],
        6,
      ]),
      ['mark.fell', here(this.view.marks), 7],
    ];
    const key = JSON.stringify([this.z, layers]);
    if (key === this.key) return;
    this.key = key;
    for (const s of this.shown) s.destroy();
    this.shown = [];
    const frames = this.scene.textures.get(ITEMS);
    for (const [frame, spots, depth] of layers) {
      if (!frames.has(frame)) continue;
      for (const { x, y } of spots)
        this.shown.push(
          this.scene.add
            .image(x * TILE, y * TILE, ITEMS, frame)
            .setOrigin(0)
            .setDepth(depth),
        );
    }
  }
}
