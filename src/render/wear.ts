// Worn ground on the map (P5.10, taste board pick A): earth showing through grass where people
// walk, in the stages the chunks' `worn` bytes carry, on the ground kinds that wear
// (`terrain.wear.kinds`). A tile layer of its own from the `tiles-world` sheet (`wear.<stage>.<1|2>`,
// the variant by position hash) over the ground and stains, under lying snow (depth 1.05).
// Kept only for the window near the camera (tile-window.ts) and repainted when a chunk arrives
// or the window moves; none of it is game state.
import type Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { ChunkView } from '../worker/index.ts';
import { frameIndex, variantOf } from './frames.ts';
import { HeldChunks, WindowTiles, type Area } from './tile-window.ts';

const GROUND = 'tiles-world';

export class WearLayer {
  private readonly scene: Phaser.Scene;
  private readonly held = new HeldChunks();
  private tiles: WindowTiles | undefined;
  private z = 0;
  /** Per terrain kind index: 1 where worn ground shows. */
  private readonly wears = new Uint8Array(content.terrain.kinds.length);

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    content.terrain.kinds.forEach((k, i) => {
      this.wears[i] = content.terrain.wear.kinds.includes(k.id) ? 1 : 0;
    });
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

  /** The window moved or the overview came or went (tile-window.ts). */
  place(area: Area): void {
    if (!this.scene.textures.exists(GROUND)) return;
    this.tiles ??= new WindowTiles(this.scene, [GROUND], [{ depth: 1.05 }]);
    this.tiles.setWanted(this.z === 0);
    this.tiles.place(area);
    for (const c of this.held.within(area)) this.paint(c);
  }

  show(on: boolean): void {
    this.tiles?.setShown(on);
  }

  private paint(c: ChunkView): void {
    const tiles = this.tiles!;
    const textures = this.scene.textures;
    for (let row = 0; row < c.h; row += 1)
      for (let col = 0; col < c.w; col += 1) {
        const at = row * c.w + col;
        const [x, y] = [c.x + col, c.y + row];
        if (!tiles.has(x, y)) continue;
        const stage = c.worn?.[at] ?? 0;
        const name = `wear.${stage}.${variantOf(x, y, 2)}`;
        const on = stage && this.wears[c.tiles[at]!] && textures.get(GROUND).has(name);
        tiles.put(0, on ? frameIndex(textures, GROUND, name) : -1, x, y);
      }
  }
}
