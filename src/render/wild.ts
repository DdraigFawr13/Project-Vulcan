// The wild valley on the map (Phase 5A Bundle 2): snow lying on the ground, the prints animals
// leave on it and in the mud, the animals themselves and the middens. Snow is a tile layer of its
// own over the ground and stains (depth 1.1); prints are sprites under the features (depth 1.8),
// fainter as they age; animals glide between tiles like people (depth 8). Everything is redrawn
// only when its chunk or its list changes; none of it is game state.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { AnimalView, ChunkView, Spot3 } from '../worker/index.ts';
import { frameIndex, TILE } from './frames.ts';
import { WILD } from './sheets.ts';

const GROUND = 'tiles-world';
const SNOW = 'tile.snow.1';
const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
/** Gliding, as for people: at least a tile a game minute at 1x, never about 0.1 s behind. */
const GLIDE = 320;
const CATCH_UP = 100;
const STRIDE = 160;

/** The alpha of a print `age` hours old: 1 when fresh, 0.15 at the end of its life. */
export const printAlpha = (age: number, hours: number): number =>
  0.15 + 0.85 * (1 - Math.min(1, Math.max(0, age / hours)));

interface Shown {
  view: AnimalView;
  image: Phaser.GameObjects.Image;
  walked: number;
}

export class WildSprites {
  private readonly scene: Phaser.Scene;
  private live = false;
  private z = 0;
  private size = { width: 0, height: 0 };
  /** Chunks that arrived before the scene could draw them. */
  private waiting: ChunkView[] = [];
  private snowMap: Phaser.Tilemaps.Tilemap | undefined;
  private snowLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  private prints = new Map<string, Phaser.GameObjects.Image[]>();
  private animals = new Map<number, Shown>();
  private list: AnimalView[] = [];
  private middens: Phaser.GameObjects.Image[] = [];
  private middenKey = '';

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.build();
        scene.events.on(Phaser.Scenes.Events.UPDATE, (_: number, delta: number) =>
          this.glide(delta),
        );
      }),
    );
  }

  /** A world began: forget the last one's snow, prints and animals. */
  setMapSize(width: number, height: number): void {
    this.size = { width, height };
    this.waiting = [];
    this.list = [];
    this.middenKey = '';
    this.build();
  }

  applyChunks(chunks: readonly ChunkView[]): void {
    const surface = chunks.filter((c) => c.z === 0);
    if (!this.snowLayer) return void this.waiting.push(...surface);
    for (const c of surface) this.paint(c);
  }

  setLevel(z: number): void {
    this.z = z;
    this.snowLayer?.setVisible(z === 0);
    for (const images of this.prints.values()) for (const i of images) i.setVisible(z === 0);
    for (const s of this.animals.values()) s.image.setVisible(z === 0);
    for (const m of this.middens) m.setVisible(z === 0);
  }

  /** The animals now on the surface (sent when any moved). */
  set(list: readonly AnimalView[]): void {
    this.list = [...list];
    if (!this.live || !this.scene.textures.exists(WILD)) return;
    const ids = new Set(list.map((a) => a.id));
    for (const [id, s] of this.animals)
      if (!ids.has(id)) {
        s.image.destroy();
        this.animals.delete(id);
      }
    for (const view of list) {
      const shown = this.animals.get(view.id);
      if (shown) {
        shown.view = view;
        continue;
      }
      const image = this.scene.add
        .image(view.x * TILE, view.y * TILE, WILD, frameOf(view, 0))
        .setOrigin(0)
        .setDepth(8)
        .setVisible(this.z === 0);
      this.animals.set(view.id, { view, image, walked: 0 });
    }
  }

  /** The animal on a tile of the surface, if the level on screen is the surface. */
  at(x: number, y: number): number | undefined {
    if (this.z !== 0) return undefined;
    for (const { view, image } of this.animals.values()) {
      const here =
        Math.floor((image.x + TILE / 2) / TILE) === x &&
        Math.floor((image.y + TILE / 2) / TILE) === y;
      if (here || (view.x === x && view.y === y)) return view.id;
    }
    return undefined;
  }

  /** Where the first animal (of art kind `kind`, if given) stands, in map px: the smoke's way to
   * find one to tap. */
  first(kind?: string): { x: number; y: number } | undefined {
    const image = [...this.animals.values()].find((s) => !kind || s.view.kind === kind)?.image;
    return image && { x: image.x + TILE / 2, y: image.y + TILE / 2 };
  }

  /** The middens the colony sited (people engine), as `site.midden`. */
  setMiddens(spots: readonly Spot3[]): void {
    const key = JSON.stringify(spots);
    if (key === this.middenKey || !this.live || !this.scene.textures.exists(WILD)) return;
    this.middenKey = key;
    for (const m of this.middens) m.destroy();
    this.middens = spots
      .filter((s) => s.z === 0)
      .map((s) =>
        this.scene.add
          .image(s.x * TILE, s.y * TILE, WILD, 'site.midden')
          .setOrigin(0)
          .setDepth(5.5)
          .setVisible(this.z === 0),
      );
  }

  /** Makes the snow layer for the current map size, then lays what was held. */
  private build(): void {
    this.snowMap?.destroy();
    for (const images of this.prints.values()) for (const i of images) i.destroy();
    this.prints.clear();
    for (const s of this.animals.values()) s.image.destroy();
    this.animals.clear();
    this.snowMap = this.snowLayer = undefined;
    const { width, height } = this.size;
    if (!this.live || !width || !this.scene.textures.exists(GROUND)) return;
    const blank = Array.from({ length: height }, () => new Array<number>(width).fill(-1));
    const map = this.scene.make.tilemap({ data: blank, tileWidth: TILE, tileHeight: TILE });
    const set = map.addTilesetImage(GROUND, GROUND, TILE, TILE, 1, 2, 0);
    const layer =
      set && (map.createLayer(0, set, 0, 0, false) as Phaser.Tilemaps.TilemapLayer | null);
    if (!layer) throw new Error('The snow layer could not be made.');
    this.snowMap = map;
    this.snowLayer = layer.setDepth(1.1).setVisible(this.z === 0);
    const held = this.waiting;
    this.waiting = [];
    for (const c of held) this.paint(c);
    this.set(this.list);
  }

  /** Repaints a surface chunk's snow tiles and prints. */
  private paint(c: ChunkView): void {
    const layer = this.snowLayer!;
    const snow = frameIndex(this.scene.textures, GROUND, SNOW);
    for (let row = 0; row < c.h; row += 1)
      for (let col = 0; col < c.w; col += 1) {
        const at = row * c.w + col;
        if (c.snowLie[at]) layer.putTileAt(snow, c.x + col, c.y + row);
        else layer.removeTileAt(c.x + col, c.y + row);
      }
    const key = `${c.x},${c.y}`;
    for (const i of this.prints.get(key) ?? []) i.destroy();
    const images: Phaser.GameObjects.Image[] = [];
    const hours = content.wild.printHours;
    for (let row = 0; row < c.h; row += 1)
      for (let col = 0; col < c.w; col += 1) {
        const at = row * c.w + col;
        const kind = c.printKind[at];
        if (!kind || c.printAge[at]! > hours) continue;
        const def = content.wild.prints[kind - 1];
        const frame = `print.${def?.id}.${COMPASS[c.printDir[at]!]}`;
        if (!def || !this.scene.textures.get(WILD).has(frame)) continue;
        images.push(
          this.scene.add
            .image((c.x + col) * TILE, (c.y + row) * TILE, WILD, frame)
            .setOrigin(0)
            .setDepth(1.8)
            .setAlpha(printAlpha(c.printAge[at]!, hours))
            .setVisible(this.z === 0),
        );
      }
    this.prints.set(key, images);
  }

  /** Each frame: slide every animal to its tile, facing as sent, with two walk frames. */
  private glide(delta: number): void {
    for (const s of this.animals.values()) {
      const [tx, ty] = [s.view.x * TILE, s.view.y * TILE];
      const [dx, dy] = [tx - s.image.x, ty - s.image.y];
      const far = Math.hypot(dx, dy);
      if (far < 0.5) {
        if (s.walked) s.image.setFrame(frameOf(s.view, 0));
        s.walked = 0;
        continue;
      }
      const pace = Math.max((GLIDE * delta) / 1000, (far * delta) / CATCH_UP);
      const reach = far > TILE * 20 ? far : Math.min(far, pace);
      s.image.setPosition(s.image.x + (dx / far) * reach, s.image.y + (dy / far) * reach);
      s.walked += delta;
      s.image.setFrame(frameOf(s.view, Math.floor(s.walked / STRIDE) % 2));
    }
  }
}

const frameOf = (v: AnimalView, step: number): string => `animal.${v.kind}.${v.facing}.${step}`;
