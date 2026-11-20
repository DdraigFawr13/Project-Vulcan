// Tall trees (art step 2, Morgan's note on the Gemini look form: "make sure everything is the right
// scale / height"): a feature whose art has a `<art>.1.top` frame in `sprites-nature` stands two
// tiles tall. Its own tile shows the trunk (`<art>.1`, the features layer) and the tile above shows
// the crown, on this layer over the people (depth 8.3), so someone walking behind a tree passes
// under its crown. Surface only; kept for the window near the camera (tile-window.ts), repainted
// when a chunk arrives or the window moves; none of it is game state.
import type Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { ChunkView } from '../worker/index.ts';
import { frameIndex } from './frames.ts';
import { HeldChunks, WindowTiles, type Area } from './tile-window.ts';

const NATURE = 'sprites-nature';
const DEPTH = 8.3;

export class CanopyLayer {
  private readonly scene: Phaser.Scene;
  private readonly held = new HeldChunks();
  private tiles: WindowTiles | undefined;
  private z = 0;
  /** Per feature index: its crown's frame in the nature sheet, or -1 for a one-tile feature. */
  private tops: number[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setMapSize(): void {
    this.held.clear();
  }

  applyChunks(chunks: readonly ChunkView[]): void {
    for (const c of chunks) if (c.z === 0) this.held.keep(c);
    if (this.tiles?.ready) for (const c of chunks) if (c.z === 0) this.paint(c);
  }

  setLevel(z: number): void {
    this.z = z;
    this.tiles?.setWanted(z === 0);
  }

  /** The window moved (tile-window.ts): lay the crowns of the chunks under it. */
  place(area: Area): void {
    const textures = this.scene.textures;
    if (!textures.exists(NATURE)) return;
    if (!this.tiles) {
      this.tops = content.features.map((f) =>
        textures.get(NATURE).has(`${f.art}.1.top`)
          ? frameIndex(textures, NATURE, `${f.art}.1.top`)
          : -1,
      );
      this.tiles = new WindowTiles(this.scene, [NATURE], [{ depth: DEPTH }]);
    }
    this.tiles.setWanted(this.z === 0);
    this.tiles.place(area);
    // The chunk below the window lays the crowns on its last row.
    for (const c of this.held.within({ ...area, h: area.h + 1 })) this.paint(c);
  }

  show(on: boolean): void {
    this.tiles?.setShown(on);
  }

  /** Each tile decides the crown on the tile above it, so a chunk repaints the row over its top. */
  private paint(c: ChunkView): void {
    const tiles = this.tiles!;
    for (let row = 0; row < c.h; row += 1)
      for (let col = 0; col < c.w; col += 1) {
        const feature = c.features[row * c.w + col]!;
        tiles.put(0, feature > 0 ? this.tops[feature - 1]! : -1, c.x + col, c.y + row - 1);
      }
  }
}
