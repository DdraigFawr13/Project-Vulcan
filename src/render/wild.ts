// The wild valley on the map (Phase 5A Bundle 2): snow lying on the ground, the prints animals
// leave on it and in the mud, the animals themselves and the middens. Snow is a tile layer of its
// own over the ground and stains (depth 1.1), kept for the window near the camera; prints are sprites under the features (depth 1.8),
// fainter as they age; animals glide between tiles like people (depth 8). Everything is redrawn
// only when its chunk or its list changes; none of it is game state.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { AnimalView, ChunkView, Spot3 } from '../worker/index.ts';
import { FADE } from './fade.ts';
import { frameIndex, TILE } from './frames.ts';
import { WILD } from './sheets.ts';
import { HeldChunks, WindowTiles, type Area } from './tile-window.ts';
import { Trails, type TrailClock } from './trail.ts';

const GROUND = 'tiles-world';
const SNOW = 'tile.snow.1';
const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
/** Milliseconds per walk frame; animals walk their trails as people do (trail.ts). */
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
  /** Lying snow, kept for the window near the camera (tile-window.ts). */
  private snow: WindowTiles | undefined;
  private readonly held = new HeldChunks();
  private prints = new Map<string, Phaser.GameObjects.Image[]>();
  private animals = new Map<number, Shown>();
  private list: AnimalView[] = [];
  private middens: Phaser.GameObjects.Image[] = [];
  private middenKey = '';
  private readonly trails = new Trails();
  private readonly clock: TrailClock;
  /** 1 where a surface tile has been seen: an animal on unseen land is not drawn (V-213). */
  private known = new Uint8Array(0);

  constructor(game: Phaser.Game, scene: Phaser.Scene, clock: TrailClock) {
    this.scene = scene;
    this.clock = clock;
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
    this.known = new Uint8Array(width * height);
    this.waiting = [];
    this.held.clear();
    this.list = [];
    this.middenKey = '';
    this.build();
  }

  applyChunks(chunks: readonly ChunkView[]): void {
    const surface = chunks.filter((c) => c.z === 0);
    for (const c of surface) this.held.keep(c);
    for (const c of surface)
      for (let row = 0; row < c.h; row += 1)
        this.known.set(
          c.known.subarray(row * c.w, (row + 1) * c.w),
          (c.y + row) * this.size.width + c.x,
        );
    if (!this.live) return void this.waiting.push(...surface);
    for (const c of surface) this.paint(c);
  }

  setLevel(z: number): void {
    this.z = z;
    this.snow?.setWanted(z === 0);
    for (const images of this.prints.values()) for (const i of images) i.setVisible(z === 0);
    for (const s of this.animals.values()) s.image.setVisible(z === 0);
    for (const m of this.middens) m.setVisible(z === 0);
  }

  /** The animals now on the surface (sent when any moved). */
  set(list: readonly AnimalView[]): void {
    this.list = [...list];
    this.trails.keep(new Set(list.map((a) => a.id)));
    for (const a of list) this.trails.note(a.id, this.clock.latest, a.x, a.y);
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
      if (!image.visible) continue;
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
    // Only one drawn: an animal on unseen land is not (V-213).
    const image = [...this.animals.values()].find(
      (s) => s.image.visible && (!kind || s.view.kind === kind),
    )?.image;
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

  /** The window moved (tile-window.ts): lay the snow of the chunks under it. */
  place(area: Area): void {
    if (!this.scene.textures.exists(GROUND)) return;
    this.snow ??= new WindowTiles(this.scene, [GROUND], [{ depth: 1.1 }]);
    this.snow.setWanted(this.z === 0);
    this.snow.place(area);
    for (const c of this.held.within(area)) this.paintSnow(c);
  }

  show(on: boolean): void {
    this.snow?.setShown(on);
  }

  /** Forgets the last world's prints and animals, then lays what was held. */
  private build(): void {
    for (const images of this.prints.values()) for (const i of images) i.destroy();
    this.prints.clear();
    for (const s of this.animals.values()) s.image.destroy();
    this.animals.clear();
    if (!this.live || !this.size.width) return;
    const held = this.waiting;
    this.waiting = [];
    for (const c of held) this.paint(c);
    this.set(this.list);
  }

  /** Repaints a surface chunk's snow tiles and prints. */
  private paint(c: ChunkView): void {
    if (this.snow?.ready) this.paintSnow(c);
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

  private paintSnow(c: ChunkView): void {
    const snow = frameIndex(this.scene.textures, GROUND, SNOW);
    for (let row = 0; row < c.h; row += 1)
      for (let col = 0; col < c.w; col += 1)
        this.snow!.put(0, c.snowLie[row * c.w + col] ? snow : -1, c.x + col, c.y + row)
          // Snow on unseen land fades with it (fade.ts).
          ?.setAlpha(c.known[row * c.w + col] ? 1 : FADE);
  }

  /** Each frame: draw every animal where the screen's clock finds it on its trail, facing as
   * sent, with two walk frames while it moves. */
  private glide(delta: number): void {
    const now = this.clock.at(this.scene.game.loop.time);
    for (const s of this.animals.values()) {
      const d = this.trails.at(s.view.id, now);
      const [x, y] = d ? [d.x, d.y] : [s.view.x, s.view.y];
      s.image.setPosition(x * TILE, y * TILE);
      const seen = this.known[Math.round(y) * this.size.width + Math.round(x)] === 1;
      s.image.setVisible(this.z === 0 && seen);
      if (!d?.moving) {
        if (s.walked) s.image.setFrame(frameOf(s.view, 0));
        s.walked = 0;
        continue;
      }
      s.walked += delta;
      s.image.setFrame(frameOf(s.view, Math.floor(s.walked / STRIDE) % 2));
    }
  }
}

const frameOf = (v: AnimalView, step: number): string => `animal.${v.kind}.${v.facing}.${step}`;
