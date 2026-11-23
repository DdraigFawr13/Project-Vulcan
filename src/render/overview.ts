// The overview picture (Phase 6W Slice 2, docs/MAP_OVERVIEW.md): zoomed out past ½×, the map is
// one small picture, a pixel a tile, each tile in the average colour of its own art (tiles.ts
// colours), instead of tile layers. A picture for each level, kept up to date from the chunks
// that change; unknown rock below is black (V-030), its veins too (V-215). Colonists on the
// level on screen are ember dots over it. View only (V-015, V-041): nothing here is game state.
import Phaser from 'phaser';
import type { GoodsView } from '../worker/index.ts';
import type { LevelArrays } from './chunk-store.ts';
import type { Spot } from './finder.ts';
import { TILE } from './frames.ts';
import { overColour, type Colours, type Rgba } from './overview-colours.ts';
import type { Area } from './tile-window.ts';
import { tokenColour } from './tokens.ts';

/** Over every map layer and sprite, under nothing on the canvas. */
const DEPTH = 20;
/** A colonist's dot, in screen px across. */
const DOT = 7;

interface Picture {
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  pixels: ImageData;
  dirty: boolean;
}

export class Overview {
  private readonly pictures = new Map<number, Picture>();
  private readonly dots: Phaser.GameObjects.Graphics;
  private size = { width: 0, height: 0 };
  private z = 0;
  private on = false;
  private fields: GoodsView['fields'] = [];
  /** Field tiles on the surface and their furrows' colour. */
  private fieldAt = new Map<number, Rgba>();
  private ember = 0;
  private edge = 0;
  /** Each world gets fresh texture keys, so a picture of the last one is never reused. */
  private world = 0;

  private readonly scene: Phaser.Scene;
  private readonly colours: Colours;
  private readonly spots: () => Spot[];

  constructor(scene: Phaser.Scene, colours: Colours, spots: () => Spot[]) {
    this.scene = scene;
    this.colours = colours;
    this.spots = spots;
    this.dots = scene.add
      .graphics()
      .setDepth(DEPTH + 1)
      .setVisible(false);
    this.ember = tokenColour('--ember', '#c8743a');
    this.edge = tokenColour('--ink', '#2b2016');
  }

  /** A new world: drops every level's picture. */
  setMapSize(width: number, height: number): void {
    for (const p of this.pictures.values()) {
      p.image.destroy();
      p.texture.destroy();
    }
    this.pictures.clear();
    this.size = { width, height };
    this.world += 1;
  }

  /** Repaints `rect` of level `z`'s picture from its arrays. */
  paint(z: number, level: LevelArrays, rect: Area): void {
    const p = this.picture(z);
    if (!p) return;
    const { width, height } = this.size;
    const x0 = Math.max(0, rect.x);
    const y0 = Math.max(0, rect.y);
    const x1 = Math.min(width, rect.x + rect.w);
    const y1 = Math.min(height, rect.y + rect.h);
    const data = p.pixels.data;
    for (let y = y0; y < y1; y += 1)
      for (let x = x0; x < x1; x += 1) {
        const i = y * width + x;
        const c = (z === 0 && this.fieldAt.get(i)) || overColour(this.colours, level, i, z === 0);
        data.set(c, i * 4);
      }
    p.dirty = true;
  }

  /** The fields on the surface (goods), drawn in their furrows' colour. */
  setFields(fields: GoodsView['fields'], surface: LevelArrays | undefined): void {
    const key = (f: GoodsView['fields']) => JSON.stringify(f);
    if (key(fields) === key(this.fields)) return;
    const touched = [...this.fields, ...fields].flatMap((f) => f.tiles);
    this.fields = fields;
    this.fieldAt = this.fieldColours();
    if (!surface || !touched.length) return;
    const { width } = this.size;
    for (const i of new Set(touched))
      this.paint(0, surface, { x: i % width, y: Math.floor(i / width), w: 1, h: 1 });
  }

  private fieldColours(): Map<number, Rgba> {
    const out = new Map<number, Rgba>();
    for (const { frame, tiles } of this.fields) {
      const c = this.colours.field(frame);
      if (c) for (const i of tiles) out.set(i, c);
    }
    return out;
  }

  setLevel(z: number): void {
    this.z = z;
    this.apply();
  }

  /** Shows the picture (zoomed out past ½×) or the tiles. */
  show(on: boolean): void {
    this.on = on;
    this.apply();
  }

  private apply(): void {
    for (const [z, p] of this.pictures) p.image.setVisible(this.on && z === this.z);
    this.dots.setVisible(this.on);
    if (!this.on) this.dots.clear();
  }

  /** Each frame while shown: uploads a changed picture and draws the colonists' dots. */
  update(zoom: number): void {
    if (!this.on) return;
    const p = this.pictures.get(this.z);
    if (p?.dirty) {
      p.texture.context.putImageData(p.pixels, 0, 0);
      p.texture.refresh();
      p.dirty = false;
    }
    const g = this.dots.clear();
    const r = DOT / 2 / zoom;
    for (const s of this.spots()) {
      g.fillStyle(this.edge, 1).fillCircle(s.x, s.y, r + 1 / zoom);
      g.fillStyle(this.ember, 1).fillCircle(s.x, s.y, r);
    }
  }

  private picture(z: number): Picture | undefined {
    const { width, height } = this.size;
    if (!width || !height) return undefined;
    const had = this.pictures.get(z);
    if (had) return had;
    const texture = this.scene.textures.createCanvas(`overview-${this.world}-${z}`, width, height);
    if (!texture) return undefined;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const image = this.scene.add
      .image(0, 0, texture)
      .setOrigin(0)
      .setScale(TILE)
      .setDepth(DEPTH)
      .setVisible(this.on && z === this.z);
    const pixels = texture.context.createImageData(width, height);
    const made = { texture, image, pixels, dirty: true };
    this.pictures.set(z, made);
    return made;
  }
}
