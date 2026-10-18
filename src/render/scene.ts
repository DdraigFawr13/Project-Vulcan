// The valley scene: a ground layer and a features layer drawn from the worker's chunks for the
// level on screen, the selection corners over the tile under the pointer, and the camera. Holds
// view state only; game state comes from snapshots.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { AuraView, ChunkView } from '../worker/index.ts';
import { glowTiles } from './aura-art.ts';
import { CameraControls } from './camera.ts';
import { PEOPLE } from './people.ts';
import { waterPicture } from './water-art.ts';

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
  /** Height of the page's bar over the top of the view, in screen px. */
  private topInset = 0;
  /** Tile index in the tilesets for each terrain kind's pictures, by kind then variant. */
  private frames: number[][] = [];
  /** Tile index in the nature tileset for each feature, by content index. */
  private featureFrames: number[] = [];
  /** The ground frame laid over snow-capped rock. */
  private snowFrame = 0;
  /** Kind index, snow and feature of every tile received so far, per level (0 the surface):
   * the readout, and the water pictures, which depend on a tile's neighbours, read them. */
  private levels: { ground: Uint8Array; snow: Uint8Array; ice: Uint8Array; things: Uint8Array }[] =
    [];
  /** The level on screen; `ground`, `snow` and `things` are its arrays, empty if not reached. */
  private z = 0;
  private ground: Uint8Array = new Uint8Array(0);
  private snow: Uint8Array = new Uint8Array(0);
  private ice: Uint8Array = new Uint8Array(0);
  private things: Uint8Array = new Uint8Array(0);
  /** Per terrain kind: 0 dry, 1 shallow water, 2 deep water. */
  private kindWater: number[] = [];
  /** Per terrain kind: the nature-sheet marker drawn over it (a spring's), else -1. */
  private markers: number[] = [];
  /** The picture under open deep water: the shallow kind's first frame. */
  private shallowFrame = 0;
  private waterLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  /** The aura glow, over the features; and the spots it was last drawn from. */
  private auraLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  private spots: AuraView[] = [];
  private spotsKey = '';
  /** Open ice over a frozen lake tile's ground. */
  private iceFrame = 0;
  private waterFrames = new Map<string, number>();
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
    for (const sheet of [...GROUND_SHEETS, NATURE, PEOPLE])
      this.load.atlas(sheet, `art/${sheet}.png`, `art/${sheet}.json`);
  }

  create(): void {
    this.frames = content.terrain.kinds.map((kind) =>
      Array.from({ length: kind.variants }, (_, v) => this.groundFrame(`${kind.art}.${v + 1}`)),
    );
    this.snowFrame = this.groundFrame(`${content.terrain.generator.rock.snowArt}.1`);
    this.iceFrame = this.groundFrame('tile.ice.1');
    this.featureFrames = content.features.map((f) => this.frameIndex(NATURE, `${f.art}.1`));
    const { kinds } = content.terrain;
    this.kindWater = kinds.map((k) => (k.water === 'deep' ? 2 : k.water ? 1 : 0));
    this.markers = kinds.map((k) => (k.marker ? this.frameIndex(NATURE, `${k.marker}.1`) : -1));
    const shallow = kinds.find((k) => k.id === content.terrain.generator.water.shallow)!;
    this.shallowFrame = this.groundFrame(`${shallow.art}.1`);
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
    this.controls.setTopInset(this.topInset);
    this.input.on('pointermove', () => (this.pointerIn = true));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.hoverAt(p);
      if (this.controls?.dragging || !this.layer || !this.ground.length) return;
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
    this.levels = [];
    this.z = 0;
    this.show();
    if (this.sys.isActive() && this.frames.length) this.buildMap();
  }

  applyChunks(chunks: readonly ChunkView[]): void {
    if (!this.layer) {
      this.waiting.push(...chunks);
      return;
    }
    for (const chunk of chunks) this.store(chunk);
    // A level's first chunks arrive when it is reached: if it is on screen, draw it whole.
    if (this.ground.length === 0 && this.levels[this.z]) return this.setLevel(this.z);
    // Water pictures depend on neighbours, so each chunk repaints a tile past its edges too.
    for (const { x, y, z, w, h } of chunks)
      if (z === this.z) this.paint(x - 1, y - 1, w + 2, h + 2);
  }

  /** Shows level `z` (0 the surface): its tiles if reached, else nothing until they arrive. */
  setLevel(z: number): void {
    this.z = z;
    this.show();
    if (!this.layer) return;
    const { width, height } = this.size;
    if (this.ground.length) this.paint(0, 0, width, height);
    else {
      const blank = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
      for (const layer of [this.layer, this.waterLayer, this.featureLayer])
        this.map!.putTilesAt(blank, 0, 0, false, layer);
    }
    this.paintAura();
  }

  /** Draws the aura spots' glow on the level on screen, when the spots change. */
  setAura(spots: readonly AuraView[]): void {
    const key = JSON.stringify(spots);
    if (key === this.spotsKey) return;
    this.spotsKey = key;
    this.spots = [...spots];
    this.paintAura();
  }

  private paintAura(): void {
    const layer = this.auraLayer;
    if (!layer || !this.map) return;
    const { width, height } = this.size;
    this.map.putTilesAt(
      Array.from({ length: height }, () => new Array<number>(width).fill(-1)),
      0,
      0,
      false,
      layer,
    );
    for (const { x, y, frame, alpha } of glowTiles(this.spots, this.z)) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      this.map.putTileAt(this.waterFrame(frame), x, y, false, layer)?.setAlpha(alpha);
    }
  }

  private show(): void {
    const level = this.levels[this.z];
    this.ground = level?.ground ?? new Uint8Array(0);
    this.snow = level?.snow ?? new Uint8Array(0);
    this.ice = level?.ice ?? new Uint8Array(0);
    this.things = level?.things ?? new Uint8Array(0);
  }

  zoomStep(direction: 1 | -1): void {
    this.controls?.zoomStep(direction);
  }

  setTopInset(px: number): void {
    this.topInset = px;
    this.controls?.setTopInset(px);
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
    // Shore and deep-water frames lie over the ground, then features on a plain layer of their
    // own, -1 where a tile is bare.
    const water = map.createBlankLayer('water', ground, 0, 0, width, height);
    const features = map.createBlankLayer('features', nature, 0, 0, width, height);
    const aura = map.createBlankLayer('aura', ground, 0, 0, width, height);
    if (!layer || !water || !features || !aura)
      throw new Error('The map layers could not be made.');
    this.waterLayer = water;
    this.auraLayer = aura;
    this.map = map;
    this.layer = layer;
    this.featureLayer = features;
    this.controls?.frameMap(width * TILE, height * TILE);
    const waiting = this.waiting;
    this.waiting = [];
    this.applyChunks(waiting);
  }

  private store({ x, y, z, w, h, tiles, features, snow, ice }: ChunkView): void {
    const n = this.size.width * this.size.height;
    const level = (this.levels[z] ??= {
      ground: new Uint8Array(n),
      snow: new Uint8Array(n),
      ice: new Uint8Array(n),
      things: new Uint8Array(n),
    });
    for (let row = 0; row < h; row += 1)
      for (let col = 0; col < w; col += 1) {
        const i = (y + row) * this.size.width + x + col;
        level.ground[i] = tiles[row * w + col]!;
        level.snow[i] = snow[row * w + col]!;
        level.ice[i] = ice[row * w + col]!;
        level.things[i] = features[row * w + col]!;
      }
  }

  // Rewrites the ground, water and feature pictures of a rectangle, clipped to the map.
  private paint(x0: number, y0: number, w0: number, h0: number): void {
    const { width, height } = this.size;
    const x = Math.max(0, x0);
    const y = Math.max(0, y0);
    const w = Math.min(width, x0 + w0) - x;
    const h = Math.min(height, y0 + h0) - y;
    const water = (i: number): number => this.kindWater[this.ground[i]!]!;
    const rows: number[][] = [];
    const over: number[][] = [];
    const things: number[][] = [];
    for (let row = y; row < y + h; row += 1) {
      const line: number[] = [];
      const wet: number[] = [];
      const on: number[] = [];
      for (let col = x; col < x + w; col += 1) {
        const i = row * width + col;
        const picture = waterPicture(col, row, width, height, water);
        // Frozen water shows the same shapes in ice (tools/draw-ice.mjs).
        const frozen = this.ice[i] === 1;
        const iced = (name: string): string => (frozen ? name.replace('water.', 'ice.') : name);
        if (picture.kind === 'shore') {
          line.push(this.pictureOf(picture.under, col, row));
          wet.push(this.waterFrame(iced(picture.frame)));
        } else if (picture.kind === 'open' && picture.deep) {
          line.push(frozen ? this.iceFrame : this.shallowFrame);
          wet.push(this.waterFrame(iced(picture.deep)));
        } else if (picture.kind === 'open' && frozen) {
          line.push(this.iceFrame);
          wet.push(-1);
        } else {
          line.push(this.pictureOf(i, col, row));
          wet.push(-1);
        }
        const feature = this.things[i]!;
        const marker = this.markers[this.ground[i]!]!;
        on.push(
          feature > 0
            ? this.natureGid + this.featureFrames[feature - 1]!
            : marker >= 0
              ? this.natureGid + marker
              : -1,
        );
      }
      rows.push(line);
      over.push(wet);
      things.push(on);
    }
    this.map!.putTilesAt(rows, x, y, false, this.layer);
    this.map!.putTilesAt(over, x, y, false, this.waterLayer);
    this.map!.putTilesAt(things, x, y, false, this.featureLayer);
  }

  /** Tile `i`'s own picture, its variant picked by where it is drawn (at col, row). */
  private pictureOf(i: number, col: number, row: number): number {
    if (this.snow[i]) return this.snowFrame;
    const kind = this.ground[i]!;
    const pictures = this.frames[kind];
    if (!pictures) throw new Error(`Terrain ${kind} has no art.`);
    return pictures[variantOf(col, row, pictures.length) - 1]!;
  }

  private waterFrame(name: string): number {
    let index = this.waterFrames.get(name);
    if (index === undefined) {
      index = this.groundFrame(name);
      this.waterFrames.set(name, index);
    }
    return index;
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
    const tile = this.ground.length ? this.tileAt(pointer) : undefined;
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
