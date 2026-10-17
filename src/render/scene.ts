// The valley scene: a ground layer and a features layer drawn from the worker's chunks, the
// selection corners over the tile under the pointer, and the camera. Holds view state only; game state comes from snapshots.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { ChunkView } from '../worker/index.ts';
import { CameraControls } from './camera.ts';

export const TILE = 32;
const SHEET = 'tiles-base';
/** Ground sheets, in tileset order, and the sheet trees, bushes, herbs and boulders come from. */
const GROUND_SHEETS = [SHEET, 'tiles-world'] as const;
const NATURE = 'sprites-nature';

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
  private layer: Phaser.Tilemaps.TilemapLayer | undefined;
  private featureLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  private select?: Phaser.GameObjects.Image;
  /** Marks the tile the inspector is showing. */
  private marked?: Phaser.GameObjects.Image;
  private controls?: CameraControls;
  /** Tile index in the tilesets for each terrain kind's pictures, by kind then variant. */
  private frames: number[][] = [];
  /** Tile index in the nature tileset for each feature, by content index. */
  private featureFrames: number[] = [];
  /** Kind index of every tile drawn so far, for the readout. */
  private ground: Uint8Array = new Uint8Array(0);
  private size = { width: 0, height: 0 };
  /** The first tile index of the nature tileset. */
  private natureGid = 0;
  /** Chunks that arrived before `create` ran, or before the map size was known. */
  private waiting: ChunkView[] = [];
  private pointerIn = false;
  onHover: (hover: Hover | undefined) => void = () => {};
  /** A tap or click on a tile that was not the end of a drag or pinch. */
  onSelect: (tile: { x: number; y: number }) => void = () => {};

  constructor() {
    super('valley');
  }

  preload(): void {
    for (const sheet of [...GROUND_SHEETS, NATURE])
      this.load.atlas(sheet, `art/${sheet}.png`, `art/${sheet}.json`);
  }

  create(): void {
    this.frames = content.terrain.kinds.map((kind) =>
      Array.from({ length: kind.variants }, (_, v) => this.groundFrame(`${kind.art}.${v + 1}`)),
    );
    this.featureFrames = content.features.map((f) => this.frameIndex(NATURE, `${f.art}.1`));
    this.select = this.add
      .image(0, 0, SHEET, 'overlay.select')
      .setOrigin(0)
      .setDepth(10)
      .setVisible(false);
    this.marked = this.add
      .image(0, 0, SHEET, 'overlay.designate')
      .setOrigin(0)
      .setDepth(9)
      .setVisible(false);
    // The camera's controls listen first, so a release that ends a drag still reads as one here.
    this.controls = new CameraControls(this);
    this.input.on('pointermove', () => (this.pointerIn = true));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.hoverAt(p);
      if (this.controls?.dragging || !this.layer) return;
      const tile = this.tileAt(p);
      if (tile) this.onSelect(tile);
    });
    this.input.on('gameout', () => (this.pointerIn = false));
    if (this.size.width) this.buildMap();
  }

  override update(_time: number, delta: number): void {
    this.controls?.update(delta);
    // Panning, zooming and redraws move the map under a still pointer, so check it every frame.
    const pointer = this.input.activePointer;
    if (pointer.wasTouch && !pointer.isDown) return; // a finger keeps its last tapped tile
    this.hoverAt(this.pointerIn ? pointer : undefined);
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
  }

  zoomStep(direction: 1 | -1): void {
    this.controls?.zoomStep(direction);
  }

  /** Puts the inspector's mark on a tile, or takes it away. */
  mark(tile: { x: number; y: number } | undefined): void {
    this.marked?.setVisible(!!tile).setPosition((tile?.x ?? 0) * TILE, (tile?.y ?? 0) * TILE);
  }

  private tileAt(pointer: Phaser.Input.Pointer): { x: number; y: number } | undefined {
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const x = Math.floor(world.x / TILE);
    const y = Math.floor(world.y / TILE);
    return x >= 0 && y >= 0 && x < this.size.width && y < this.size.height ? { x, y } : undefined;
  }

  private buildMap(): void {
    if (this.layer) return;
    const { width, height } = this.size;
    // A plain layer, not Phaser's GPU layer: the GPU layer's shader reads tile indices back from a
    // texture without rounding, and on some phones index 4 came back as 3.99, drawing a sliver of
    // the dirt frame stretched over every first grass picture (Morgan's playtest, 2026-10-17).
    const blank = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
    const map = this.make.tilemap({ data: blank, tileWidth: TILE, tileHeight: TILE });
    // Ground sheets share one layer, each tileset starting where the last one ended.
    let gid = 0;
    const ground = GROUND_SHEETS.map((sheet) => {
      const set = map.addTilesetImage(sheet, sheet, TILE, TILE, 1, 2, gid);
      if (!set) throw new Error(`The ${sheet} sheet did not load.`);
      gid += set.total;
      return set;
    });
    const nature = map.addTilesetImage(NATURE, NATURE, TILE, TILE, 1, 2, gid);
    if (!nature) throw new Error(`The ${NATURE} sheet did not load.`);
    this.natureGid = gid;
    const layer = map.createLayer(0, ground, 0, 0, false) as Phaser.Tilemaps.TilemapLayer | null;
    // The features sit on a second plain layer over the ground, -1 where a tile is bare.
    const features = map.createBlankLayer('features', nature, 0, 0, width, height);
    if (!layer || !features) throw new Error('The map layers could not be made.');
    this.map = map;
    this.layer = layer;
    this.featureLayer = features;
    this.controls?.frameMap(width * TILE, height * TILE);
    const waiting = this.waiting;
    this.waiting = [];
    this.applyChunks(waiting);
  }

  // A changed chunk rewrites only its own tiles.
  private drawChunk({ x, y, w, h, tiles, features }: ChunkView): void {
    const rows: number[][] = [];
    const things: number[][] = [];
    for (let row = 0; row < h; row += 1) {
      const line: number[] = [];
      const on: number[] = [];
      for (let col = 0; col < w; col += 1) {
        const kind = tiles[row * w + col]!;
        const pictures = this.frames[kind];
        if (!pictures) throw new Error(`Terrain ${kind} has no art.`);
        line.push(pictures[variantOf(x + col, y + row, pictures.length) - 1]!);
        this.ground[(y + row) * this.size.width + x + col] = kind;
        const feature = features[row * w + col]!;
        on.push(feature > 0 ? this.natureGid + this.featureFrames[feature - 1]! : -1);
      }
      rows.push(line);
      things.push(on);
    }
    this.map!.putTilesAt(rows, x, y, false, this.layer);
    this.map!.putTilesAt(things, x, y, false, this.featureLayer);
  }

  // A tileset is its packed sheet's grid (tools/pack-sheet: margin 1, spacing 2), so a frame's
  // tile index follows from where the packer put it.
  private frameIndex(sheet: string, name: string): number {
    const texture = this.textures.get(sheet);
    if (!texture.has(name)) throw new Error(`The ${sheet} sheet has no frame "${name}".`);
    const columns = Math.floor((texture.source[0]!.width - 2 + 2) / (TILE + 2));
    const frame = texture.get(name);
    return ((frame.cutY - 1) / (TILE + 2)) * columns + (frame.cutX - 1) / (TILE + 2);
  }

  /** A ground frame's index across the ground tilesets, from whichever sheet has it. */
  private groundFrame(name: string): number {
    let offset = 0;
    for (const sheet of GROUND_SHEETS) {
      const texture = this.textures.get(sheet);
      if (texture.has(name)) return offset + this.frameIndex(sheet, name);
      const columns = Math.floor(texture.source[0]!.width / (TILE + 2));
      const rows = Math.floor(texture.source[0]!.height / (TILE + 2));
      offset += columns * rows;
    }
    throw new Error(`No ground sheet has a frame "${name}".`);
  }

  private hoverAt(pointer: Phaser.Input.Pointer | undefined): void {
    if (!this.layer) return;
    if (!pointer || this.controls?.dragging) {
      this.select?.setVisible(false);
      this.report(undefined);
      return;
    }
    const tile = this.tileAt(pointer);
    this.select?.setVisible(!!tile).setPosition((tile?.x ?? 0) * TILE, (tile?.y ?? 0) * TILE);
    const kind = tile && content.terrain.kinds[this.ground[tile.y * this.size.width + tile.x]!];
    this.report(tile && kind ? { ...tile, ground: kind.name } : undefined);
  }

  private last = '';
  // Tells the page only when the tile or its ground changes, not every frame.
  private report(hover: Hover | undefined): void {
    const key = hover ? `${hover.x},${hover.y},${hover.ground}` : '';
    if (key === this.last) return;
    this.last = key;
    this.onHover(hover);
  }
}
