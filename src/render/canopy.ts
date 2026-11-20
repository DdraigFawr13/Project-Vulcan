// Tall trees (art step 2, Morgan's note on the Gemini look form: "make sure everything is the right
// scale / height"): a feature whose art has a `<art>.1.top` frame in `sprites-nature` stands two
// tiles tall. Its own tile shows the trunk (`<art>.1`, the features layer) and the tile above shows
// the crown, on this layer over the people (depth 8.3), so someone walking behind a tree passes
// under its crown. Surface only; repainted only when a chunk arrives; none of it is game state.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { ChunkView } from '../worker/index.ts';
import { frameIndex, TILE } from './frames.ts';

const NATURE = 'sprites-nature';
const DEPTH = 8.3;

export class CanopyLayer {
  private readonly scene: Phaser.Scene;
  private live = false;
  private z = 0;
  private size = { width: 0, height: 0 };
  private waiting: ChunkView[] = [];
  private map: Phaser.Tilemaps.Tilemap | undefined;
  private layer: Phaser.Tilemaps.TilemapLayer | undefined;
  /** Per feature index: its crown's frame in the nature sheet, or -1 for a one-tile feature. */
  private tops: number[] = [];

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.build();
      }),
    );
  }

  setMapSize(width: number, height: number): void {
    this.size = { width, height };
    this.waiting = [];
    this.build();
  }

  applyChunks(chunks: readonly ChunkView[]): void {
    const surface = chunks.filter((c) => c.z === 0);
    if (!this.layer) return void this.waiting.push(...surface);
    for (const c of surface) this.paint(c);
  }

  setLevel(z: number): void {
    this.z = z;
    this.layer?.setVisible(z === 0);
  }

  private build(): void {
    this.map?.destroy();
    this.map = this.layer = undefined;
    const { width, height } = this.size;
    const textures = this.scene.textures;
    if (!this.live || !width || !textures.exists(NATURE)) return;
    this.tops = content.features.map((f) =>
      textures.get(NATURE).has(`${f.art}.1.top`)
        ? frameIndex(textures, NATURE, `${f.art}.1.top`)
        : -1,
    );
    const blank = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
    const map = this.scene.make.tilemap({ data: blank, tileWidth: TILE, tileHeight: TILE });
    const set = map.addTilesetImage(NATURE, NATURE, TILE, TILE, 1, 2, 0);
    const layer =
      set && (map.createLayer(0, set, 0, 0, false) as Phaser.Tilemaps.TilemapLayer | null);
    if (!layer) throw new Error('The tree-crown layer could not be made.');
    this.map = map;
    this.layer = layer.setDepth(DEPTH).setVisible(this.z === 0);
    const held = this.waiting;
    this.waiting = [];
    for (const c of held) this.paint(c);
  }

  /** Each tile decides the crown on the tile above it, so a chunk repaints the row over its top. */
  private paint(c: ChunkView): void {
    const layer = this.layer!;
    for (let row = 0; row < c.h; row += 1)
      for (let col = 0; col < c.w; col += 1) {
        const [x, y] = [c.x + col, c.y + row - 1];
        if (y < 0) continue;
        const feature = c.features[row * c.w + col]!;
        const top = feature > 0 ? this.tops[feature - 1]! : -1;
        if (top < 0) layer.removeTileAt(x, y);
        else layer.putTileAt(top, x, y);
      }
  }
}
