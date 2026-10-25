// Worn ground on the map (P5.10, taste board pick A): earth showing through grass where people
// walk, in the stages the chunks' `worn` bytes carry, on the ground kinds that wear
// (`terrain.wear.kinds`). A tile layer of its own from the `tiles-world` sheet (`wear.<stage>.<1|2>`,
// the variant by position hash) over the ground and stains, under lying snow (depth 1.05).
// Repainted only when a chunk arrives; none of it is game state.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { ChunkView } from '../worker/index.ts';
import { frameIndex, TILE, variantOf } from './frames.ts';

const GROUND = 'tiles-world';

export class WearLayer {
  private readonly scene: Phaser.Scene;
  private live = false;
  private z = 0;
  private size = { width: 0, height: 0 };
  private waiting: ChunkView[] = [];
  private map: Phaser.Tilemaps.Tilemap | undefined;
  private layer: Phaser.Tilemaps.TilemapLayer | undefined;
  /** Per terrain kind index: 1 where worn ground shows. */
  private readonly wears = new Uint8Array(content.terrain.kinds.length);

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    content.terrain.kinds.forEach((k, i) => {
      this.wears[i] = content.terrain.wear.kinds.includes(k.id) ? 1 : 0;
    });
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
    if (!this.live || !width || !this.scene.textures.exists(GROUND)) return;
    const blank = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
    const map = this.scene.make.tilemap({ data: blank, tileWidth: TILE, tileHeight: TILE });
    const set = map.addTilesetImage(GROUND, GROUND, TILE, TILE, 1, 2, 0);
    const layer =
      set && (map.createLayer(0, set, 0, 0, false) as Phaser.Tilemaps.TilemapLayer | null);
    if (!layer) throw new Error('The worn-ground layer could not be made.');
    this.map = map;
    this.layer = layer.setDepth(1.05).setVisible(this.z === 0);
    const held = this.waiting;
    this.waiting = [];
    for (const c of held) this.paint(c);
  }

  private paint(c: ChunkView): void {
    const layer = this.layer!;
    const textures = this.scene.textures;
    for (let row = 0; row < c.h; row += 1)
      for (let col = 0; col < c.w; col += 1) {
        const at = row * c.w + col;
        const [x, y] = [c.x + col, c.y + row];
        const stage = c.worn?.[at] ?? 0;
        if (!stage || !this.wears[c.tiles[at]!]) {
          layer.removeTileAt(x, y);
          continue;
        }
        const name = `wear.${stage}.${variantOf(x, y, 2)}`;
        if (textures.get(GROUND).has(name))
          layer.putTileAt(frameIndex(textures, GROUND, name), x, y);
      }
  }
}
