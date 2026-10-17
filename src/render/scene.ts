// The valley scene: one tilemap layer drawn from the worker's chunks, the selection corners over
// the tile under the pointer, and the camera. Holds view state only; game state comes from snapshots.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { ChunkView } from '../worker/index.ts';
import { CameraControls } from './camera.ts';

export const TILE = 32;
const SHEET = 'tiles-base';

/** What the pointer is over, for the page's readout. */
export interface Hover {
  x: number;
  y: number;
  ground: string;
}

// A position hash picks which picture of a terrain kind a tile shows. Picture choice only: it
// never touches the game's dice or state, and the same tile always looks the same.
function variantOf(x: number, y: number, variants: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (((h ^ (h >>> 15)) >>> 0) % variants) + 1;
}

export class ValleyScene extends Phaser.Scene {
  private map: Phaser.Tilemaps.Tilemap | undefined;
  private layer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | undefined;
  private select?: Phaser.GameObjects.Image;
  private controls?: CameraControls;
  /** Tile index in the tileset for each terrain kind's pictures, by kind then variant. */
  private frames: number[][] = [];
  /** Kind index of every tile drawn so far, for the readout. */
  private ground: Uint8Array = new Uint8Array(0);
  private size = { width: 0, height: 0 };
  /** Chunks that arrived before `create` ran, or before the map size was known. */
  private waiting: ChunkView[] = [];
  onHover: (hover: Hover | undefined) => void = () => {};
  onZoom: (zoom: number) => void = () => {};

  constructor() {
    super('valley');
  }

  preload(): void {
    this.load.atlas(SHEET, `art/${SHEET}.png`, `art/${SHEET}.json`);
  }

  create(): void {
    this.frames = this.tileFrames();
    this.select = this.add
      .image(0, 0, SHEET, 'overlay.select')
      .setOrigin(0)
      .setDepth(10)
      .setVisible(false);
    this.controls = new CameraControls(this, (zoom) => this.onZoom(zoom));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.hoverAt(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.hoverAt(p));
    this.input.on('gameout', () => this.hoverAt(undefined));
    if (this.size.width) this.buildMap();
  }

  override update(_time: number, delta: number): void {
    this.controls?.update(delta);
  }

  /** Sizes the map once the worker is ready. */
  setMapSize(width: number, height: number): void {
    this.size = { width, height };
    this.ground = new Uint8Array(width * height);
    if (this.sys.isActive() && this.frames.length) this.buildMap();
  }

  applyChunks(chunks: readonly ChunkView[]): void {
    if (!this.layer) {
      this.waiting.push(...chunks);
      return;
    }
    for (const chunk of chunks) this.drawChunk(chunk);
    // A GPU layer keeps its tiles in a data texture, rebuilt once per batch of changed chunks.
    if (chunks.length && 'generateLayerDataTexture' in this.layer)
      this.layer.generateLayerDataTexture();
  }

  zoomStep(direction: 1 | -1): void {
    this.controls?.zoomStep(direction);
  }

  private buildMap(): void {
    if (this.layer) return;
    const { width, height } = this.size;
    // A GPU layer draws the whole map as one quad (WebGL only); Canvas falls back to a plain layer.
    const blank = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
    const map = this.make.tilemap({ data: blank, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(SHEET, SHEET, TILE, TILE, 1, 2);
    if (!tileset) throw new Error('The tiles-base sheet did not load.');
    const gpu = this.renderer.type === Phaser.WEBGL;
    const layer = map.createLayer(0, tileset, 0, 0, gpu);
    if (!layer) throw new Error('The map layer could not be made.');
    this.map = map;
    this.layer = layer;
    this.controls?.fitTo(width * TILE, height * TILE);
    const waiting = this.waiting;
    this.waiting = [];
    this.applyChunks(waiting);
  }

  // A changed chunk rewrites only its own tiles.
  private drawChunk({ x, y, w, h, tiles }: ChunkView): void {
    const rows: number[][] = [];
    for (let row = 0; row < h; row += 1) {
      const line: number[] = [];
      for (let col = 0; col < w; col += 1) {
        const kind = tiles[row * w + col]!;
        const pictures = this.frames[kind];
        if (!pictures) throw new Error(`Terrain ${kind} has no art.`);
        line.push(pictures[variantOf(x + col, y + row, pictures.length) - 1]!);
        this.ground[(y + row) * this.size.width + x + col] = kind;
      }
      rows.push(line);
    }
    this.map!.putTilesAt(rows, x, y, false);
  }

  // The tileset is the packed sheet's grid (tools/pack-sheet: margin 1, spacing 2), so a frame's
  // tile index follows from where the packer put it.
  private tileFrames(): number[][] {
    const texture = this.textures.get(SHEET);
    const columns = Math.floor((texture.source[0]!.width - 2 + 2) / (TILE + 2));
    return content.terrain.kinds.map((kind) =>
      Array.from({ length: kind.variants }, (_, v) => {
        const name = `${kind.art}.${v + 1}`;
        if (!texture.has(name)) throw new Error(`The art sheet has no frame "${name}".`);
        const frame = texture.get(name);
        return ((frame.cutY - 1) / (TILE + 2)) * columns + (frame.cutX - 1) / (TILE + 2);
      }),
    );
  }

  private hoverAt(pointer: Phaser.Input.Pointer | undefined): void {
    if (!pointer || !this.layer || this.controls?.dragging) {
      if (!pointer) this.select?.setVisible(false);
      if (!pointer) this.onHover(undefined);
      return;
    }
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const x = Math.floor(world.x / TILE);
    const y = Math.floor(world.y / TILE);
    const inside = x >= 0 && y >= 0 && x < this.size.width && y < this.size.height;
    this.select?.setVisible(inside).setPosition(x * TILE, y * TILE);
    const kind = content.terrain.kinds[this.ground[y * this.size.width + x]!];
    this.onHover(inside && kind ? { x, y, ground: kind.name } : undefined);
  }
}
