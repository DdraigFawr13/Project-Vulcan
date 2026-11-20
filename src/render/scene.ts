// The valley scene: a ground layer and a features layer drawn from the worker's chunks for the
// level on screen, kept only for the window near the camera (tile-window.ts) and swapped for the
// overview picture zoomed out past ½× (overview.ts); the selection corners over the tile under the
// pointer, and the camera. Holds view state only; game state comes from snapshots.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { AuraView, ChunkView, GoodsView } from '../worker/index.ts';
import { glowTiles } from './aura-art.ts';
import { CameraControls } from './camera.ts';
import { storeChunk, type LevelArrays } from './chunk-store.ts';
import { frameIndex, groundFrame, TILE, variantOf } from './frames.ts';
import { BUILDINGS, ITEMS, PEOPLE, WILD } from './sheets.ts';
import type { Spot } from './finder.ts';
import { HoverMark } from './hover.ts';
import { Overview } from './overview.ts';
import { readColours } from './overview-colours.ts';
import { StainLayer } from './stains.ts';
import { WindowFollower, WindowTiles, type Area } from './tile-window.ts';
import { waterPicture } from './water-art.ts';

export { TILE } from './frames.ts';
export type { Hover } from './hover.ts';
const SHEET = 'tiles-base';
/** Ground sheets, in tileset order, and the sheet trees, bushes, herbs and boulders come from. */
const GROUND_SHEETS = [SHEET, 'tiles-world'] as const;
const NATURE = 'sprites-nature';

/** The window's tile layers in the scene's tiles: ground, shore and deep water, features, aura. */
const [GROUND, WATER, FEATURES, AURA] = [0, 1, 2, 3];

export class ValleyScene extends Phaser.Scene {
  /** The ground, water, feature and aura layers of the window near the camera. */
  private tiles: WindowTiles | undefined;
  /** The window and whether the overview is up instead; wear, snow and crowns follow it too. */
  readonly window = new WindowFollower();
  private overview: Overview | undefined;
  /** Who is drawn on the level on screen, for the overview's dots. */
  spots: () => Spot[] = () => [];
  /** Marks the tile the inspector is showing. */
  private marked?: Phaser.GameObjects.Image;
  controls?: CameraControls;
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
  private levels: LevelArrays[] = [];
  /** The level on screen; `ground`, `snow` and `things` are its arrays, empty if not reached. */
  private z = 0;
  private ground: Uint8Array = new Uint8Array(0);
  private snow: Uint8Array = new Uint8Array(0);
  private ice: Uint8Array = new Uint8Array(0);
  private things: Uint8Array = new Uint8Array(0);
  /** 1 where the tile is known (V-030); unknown ground below draws black (the taste pick). */
  private known: Uint8Array = new Uint8Array(0);
  private dark = 0;
  /** Brightness a vein keeps glinting through the dark. */
  private glint = 1;
  /** Per feature: whether it is an ore vein. */
  private veins: boolean[] = [];
  private stains?: StainLayer;
  /** Per terrain kind: 0 dry, 1 shallow water, 2 deep water. */
  private kindWater: number[] = [];
  /** Per terrain kind: the nature-sheet marker drawn over it (a spring's), else -1. */
  private markers: number[] = [];
  /** The picture under open deep water: the shallow kind's first frame. */
  private shallowFrame = 0;
  /** The aura spots the glow was last drawn from. */
  private auraSpots: AuraView[] = [];
  private spotsKey = '';
  /** Open ice over a frozen lake tile's ground. */
  private iceFrame = 0;
  private waterFrames = new Map<string, number>();
  private size = { width: 0, height: 0 };
  /** Where the view opens, in map px: the green's middle. */
  private focus: { x: number; y: number } | undefined;
  /** The first tile index of the nature tileset. */
  private natureGid = 0;
  /** Chunks that arrived before `create` ran, or before the map size was known. */
  private waiting: ChunkView[] = [];
  private pointerIn = false;
  /** The corners over the tile under the pointer, and the page's readout. */
  readonly hover = new HoverMark();
  /** A tap or click on a tile that was not the end of a drag or pinch. */
  onSelect: (tile: { x: number; y: number }) => void = () => {};

  constructor() {
    super('valley');
    this.window.layers.push({ place: (a) => this.moveTo(a), show: (on) => this.showTiles(on) });
  }

  preload(): void {
    for (const sheet of [...GROUND_SHEETS, NATURE, PEOPLE, ITEMS, BUILDINGS, WILD])
      this.load.atlas(sheet, `art/${sheet}.png`, `art/${sheet}.json`);
  }

  create(): void {
    this.frames = content.terrain.kinds.map((kind) =>
      Array.from({ length: kind.variants }, (_, v) => this.groundFrame(`${kind.art}.${v + 1}`)),
    );
    this.snowFrame = this.groundFrame(`${content.terrain.generator.rock.snowArt}.1`);
    const { fogArt, fogVein } = content.terrain.generator.underground;
    this.dark = this.groundFrame(`${fogArt}.1`);
    this.glint = fogVein;
    this.veins = content.features.map((f) => f.kind === 'vein');
    this.stains = new StainLayer(this);
    this.window.layers.push(this.stains);
    this.iceFrame = this.groundFrame('tile.ice.1');
    this.featureFrames = content.features.map((f) => this.frameIndex(NATURE, `${f.art}.1`));
    const { kinds } = content.terrain;
    this.kindWater = kinds.map((k) => (k.water === 'deep' ? 2 : k.water ? 1 : 0));
    this.markers = kinds.map((k) => (k.marker ? this.frameIndex(NATURE, `${k.marker}.1`) : -1));
    const shallow = kinds.find((k) => k.id === content.terrain.generator.water.shallow)!;
    this.shallowFrame = this.groundFrame(`${shallow.art}.1`);
    this.hover.create(this, SHEET);
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
      if (this.controls?.dragging || !this.tiles) return;
      // A tap on the overview glides in to 1× there (docs/MAP_OVERVIEW.md), selecting nothing.
      if (this.window.far) {
        const at = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        return this.controls?.glideIn(at.x, at.y);
      }
      const tile = this.ground.length ? this.tileAt(p) : undefined;
      if (tile) this.onSelect(tile);
    });
    this.overview = new Overview(this, readColours(this.textures, GROUND_SHEETS, NATURE), () =>
      this.spots(),
    );
    this.overview.setMapSize(this.size.width, this.size.height);
    this.input.on('gameout', () => (this.pointerIn = false));
    if (this.size.width) this.buildMap();
  }

  override update(_time: number, delta: number): void {
    this.controls?.update(delta);
    if (this.tiles && this.size.width) this.window.update(this.cameras.main, this.size);
    this.overview?.update(this.cameras.main.zoom);
    // Panning, zooming and redraws move the map under a still pointer, so check it every frame.
    const pointer = this.input.activePointer;
    if (pointer.wasTouch && !pointer.isDown) return; // a finger keeps its last tapped tile
    this.hoverAt(this.pointerIn ? pointer : undefined);
  }

  /** Sizes the map once the worker is ready, and opens the view on tile `on` (the green). */
  setMapSize(width: number, height: number, on?: { x: number; y: number }): void {
    this.size = { width, height };
    this.focus = on && { x: (on.x + 0.5) * TILE, y: (on.y + 0.5) * TILE };
    this.levels = [];
    this.z = 0;
    this.show();
    this.stains?.set(new Uint8Array(0), width);
    this.overview?.setMapSize(width, height);
    this.overview?.setLevel(0);
    this.window.reset();
    if (this.sys.isActive() && this.frames.length) this.buildMap();
    // A world after the first (Look elsewhere, a new game) keeps the map but opens on its own green.
    if (this.tiles) this.controls?.frameMap(width * TILE, height * TILE, this.focus);
  }

  applyChunks(chunks: readonly ChunkView[]): void {
    if (!this.tiles) {
      this.waiting.push(...chunks);
      return;
    }
    for (const c of chunks) {
      storeChunk(this.levels, c, this.size.width, this.size.height);
      this.overview?.paint(c.z, this.levels[c.z]!, c);
    }
    const surface = this.levels[0];
    if (surface && chunks.some((c) => c.z === 0)) this.stains?.set(surface.stains, this.size.width);
    // A level's first chunks arrive when it is reached: if it is on screen, draw it whole.
    if (this.ground.length === 0 && this.levels[this.z]) return this.setLevel(this.z);
    // Water pictures depend on neighbours, so each chunk repaints a tile past its edges too.
    for (const { x, y, z, w, h } of chunks)
      if (z === this.z) this.paint(x - 1, y - 1, w + 2, h + 2);
  }

  /** The fields on the surface, for the overview (the tiles draw them as sprites). */
  setFields(fields: GoodsView['fields']): void {
    this.overview?.setFields(fields, this.levels[0]);
  }

  /** The window moved: repaint its tiles from the level arrays. */
  private moveTo(area: Area): void {
    this.tiles!.place(area);
    if (this.ground.length) this.paint(area.x, area.y, area.w, area.h);
    this.paintAura();
  }

  /** The tiles show, or the overview past ½×. */
  private showTiles(on: boolean): void {
    this.tiles?.setShown(on);
    this.overview?.show(!on);
    this.hover.show(undefined);
    this.marked?.setAlpha(on ? 1 : 0);
  }

  /** Shows level `z` (0 the surface): its tiles if reached, else nothing until they arrive. */
  setLevel(z: number): void {
    this.z = z;
    this.show();
    this.stains?.setLevel(z);
    this.overview?.setLevel(z);
    if (!this.tiles?.ready) return;
    const a = this.window.area;
    if (this.ground.length) this.paint(a.x, a.y, a.w, a.h);
    else for (const k of [GROUND, WATER, FEATURES]) this.tiles.blank(k);
    this.paintAura();
  }

  /** Draws the aura spots' glow on the level on screen, when the spots change. */
  setAura(spots: readonly AuraView[]): void {
    const key = JSON.stringify(spots);
    if (key === this.spotsKey) return;
    this.spotsKey = key;
    this.auraSpots = [...spots];
    this.paintAura();
  }

  private paintAura(): void {
    const tiles = this.tiles;
    if (!tiles?.ready) return;
    tiles.blank(AURA);
    for (const { x, y, frame, alpha } of glowTiles(this.auraSpots, this.z))
      tiles.put(AURA, this.waterFrame(frame), x, y)?.setAlpha(alpha);
  }

  private show(): void {
    const level = this.levels[this.z];
    this.ground = level?.ground ?? new Uint8Array(0);
    this.snow = level?.snow ?? new Uint8Array(0);
    this.ice = level?.ice ?? new Uint8Array(0);
    this.things = level?.things ?? new Uint8Array(0);
    this.known = level?.known ?? new Uint8Array(0);
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
    if (this.tiles) return;
    // Plain layers, not Phaser's GPU layer: the GPU layer's shader reads tile indices back from a
    // texture without rounding, and on some phones index 4 came back as 3.99, drawing a sliver of
    // the dirt frame stretched over every first grass picture (Morgan's playtest, 2026-10-17).
    // Ground sheets share the layers, each tileset starting where the last one ended; shore and
    // deep-water frames lie over the ground, then features (depth 2), -1 where a tile is bare.
    const tiles = new WindowTiles(
      this,
      [...GROUND_SHEETS, NATURE],
      [{ depth: 0 }, { depth: 0 }, { depth: 2 }, { depth: 0 }],
    );
    this.tiles = tiles;
    const { width, height } = this.size;
    this.controls?.frameMap(width * TILE, height * TILE, this.focus);
    // The first window is laid at once, so the held chunks paint into it.
    this.window.update(this.cameras.main, this.size);
    this.natureGid = tiles.gids.get(NATURE) ?? 0;
    const waiting = this.waiting;
    this.waiting = [];
    this.applyChunks(waiting);
  }

  // Rewrites the ground, water and feature pictures of a rectangle, clipped to the map.
  private paint(x0: number, y0: number, w0: number, h0: number): void {
    const { width, height } = this.size;
    const tiles = this.tiles!;
    const clip = tiles.clip({ x: x0, y: y0, w: w0, h: h0 });
    if (!clip) return;
    const x = Math.max(0, clip.x);
    const y = Math.max(0, clip.y);
    const w = Math.min(width, clip.x + clip.w) - x;
    const h = Math.min(height, clip.y + clip.h) - y;
    if (w <= 0 || h <= 0) return;
    // Unknown ground is black, so it shows no water either.
    const water = (i: number): number => (this.known[i] ? this.kindWater[this.ground[i]!]! : 0);
    const rows: number[][] = [];
    const over: number[][] = [];
    const things: number[][] = [];
    for (let row = y; row < y + h; row += 1) {
      const line: number[] = [];
      const wet: number[] = [];
      const on: number[] = [];
      for (let col = x; col < x + w; col += 1) {
        const i = row * width + col;
        const dark = !this.known[i];
        const picture = waterPicture(col, row, width, height, water);
        // Frozen water shows the same shapes in ice (tools/draw-ice.mjs).
        const frozen = this.ice[i] === 1;
        const iced = (name: string): string => (frozen ? name.replace('water.', 'ice.') : name);
        if (dark) {
          line.push(this.dark);
          wet.push(-1);
        } else if (picture.kind === 'shore') {
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
        // In the dark only veins show, glinting through.
        const feature = dark && !this.veins[this.things[i]! - 1] ? 0 : this.things[i]!;
        const marker = dark ? -1 : this.markers[this.ground[i]!]!;
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
    tiles.putRows(GROUND, rows, x, y);
    tiles.putRows(WATER, over, x, y);
    tiles.putRows(FEATURES, things, x, y);
    for (let row = y; row < y + h; row += 1)
      for (let col = x; col < x + w; col += 1)
        tiles.tile(FEATURES, col, row)?.setAlpha(this.known[row * width + col] ? 1 : this.glint);
  }

  /** Tile `i`'s own picture, its variant picked by where it is drawn (at col, row). */
  private pictureOf(i: number, col: number, row: number): number {
    if (!this.known[i]) return this.dark;
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

  private frameIndex(sheet: string, name: string): number {
    return frameIndex(this.textures, sheet, name);
  }

  private groundFrame(name: string): number {
    return groundFrame(this.textures, GROUND_SHEETS, name);
  }

  private hoverAt(pointer: Phaser.Input.Pointer | undefined): void {
    if (!this.tiles) return;
    const far = !pointer || this.controls?.dragging || this.window.far;
    const tile = !far && this.ground.length ? this.tileAt(pointer) : undefined;
    const at = tile ? tile.y * this.size.width + tile.x : 0;
    const kind = tile && content.terrain.kinds[this.ground[at]!];
    // Unknown ground below is not named (V-030).
    this.hover.show(
      tile && kind ? { ...tile, ground: this.known[at] ? kind.name : 'unknown' } : undefined,
    );
  }
}
