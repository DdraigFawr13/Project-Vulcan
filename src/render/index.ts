// Public surface of the render layer: boots Phaser with the valley scene and hands the page a
// small handle to feed it snapshots and drive the camera.
import Phaser from 'phaser';
import type {
  AnimalView,
  AuraView,
  BuildView,
  ChunkView,
  ClockView,
  GoodsView,
  PersonView,
  Speed,
  WalkerView,
} from '../worker/index.ts';
import { BuildSprites } from './build.ts';
import { Firelight } from './firelight.ts';
import { FurnitureSprites } from './furniture.ts';
import { FieldSprites } from './fields.ts';
import { BurialSprites } from './burial.ts';
import { ShaftSprites } from './shafts.ts';
import { GoodsSprites } from './goods.ts';
import { GreenSprites } from './green.ts';
import { PeopleSprites } from './people.ts';
import { WorkBars } from './progress.ts';
import { WildSprites } from './wild.ts';
import { WearLayer } from './wear.ts';
import { TILE, ValleyScene, type Hover } from './scene.ts';

export type { Hover } from './scene.ts';

export interface Renderer {
  /** Sizes the map and opens the view on tile `on` (the band's green), or the middle without it. */
  setMapSize(width: number, height: number, on?: { x: number; y: number }): void;
  /** Draws changed chunks; ones that arrive before the scene is ready are held until it is. */
  applyChunks(chunks: readonly ChunkView[]): void;
  /** Draws the aura spots' glow (the snapshot's `aura`); a no-op while they are unchanged. */
  setAura(spots: readonly AuraView[]): void;
  zoomStep(direction: 1 | -1): void;
  /** Centres the view on a tile, below the bar; moves the camera only. */
  lookAt(x: number, y: number): void;
  /** The page's bar covers the top `px` of the view; fitting and scrolling keep the map clear. */
  setTopInset(px: number): void;
  /** Shows level `z`: 0 the surface, 1 to 4 below. */
  setLevel(z: number): void;
  /** Draws the people on the level on screen (P2.1). */
  setPeople(people: readonly PersonView[]): void;
  /** The person standing on a tile of the level on screen, if any. */
  personAt(x: number, y: number): PersonView | undefined;
  /** Draws the live animals (the snapshot's `animals`, when sent) on the surface (Bundle 2). */
  setAnimals(animals: readonly AnimalView[]): void;
  /** The animal standing on a tile of the surface, if any: its id. */
  animalAt(x: number, y: number): number | undefined;
  /** Moves the people to where the latest snapshot stands them (P2.3); they glide there. */
  movePeople(walkers: readonly WalkerView[]): void;
  /** Draws the store, the items lying about and test marks (P2.4), the plans (P3.1) and the
   * furniture (P3.4); at night the firelight (P3.6), and the progress bars, which glide at the
   * snapshot's speed (a skip counts as the fastest). */
  setGoods(goods: GoodsView, sky: { speed: Speed; skipping: boolean; clock: ClockView }): void;
  /** Draws the green and the names of planned houses (P3.7). */
  setBuild(view: BuildView): void;
  /** Marks the inspected tile, or clears the mark. */
  mark(tile: { x: number; y: number } | undefined): void;
  /** A small picture of the current view as a JPEG data URL, for the save list; '' if none. */
  thumbnail(): Promise<string>;
  /** Frames per second Phaser measured, for the debug readout. */
  fps(): number;
  destroy(): void;
}

export function startRenderer(
  parent: HTMLElement,
  hooks: {
    onHover(hover: Hover | undefined): void;
    onSelect(tile: { x: number; y: number }): void;
  },
): Renderer {
  const scene = new ValleyScene();
  scene.onHover = hooks.onHover;
  scene.onSelect = hooks.onSelect;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1c1a17',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    // The page owns Space and the number keys (speed); Phaser only reads the pan keys.
    input: { keyboard: { capture: [] } },
    scene: [scene],
  });
  const people = new PeopleSprites(game, scene);
  const goods = new GoodsSprites(game, scene);
  const build = new BuildSprites(game, scene);
  const fields = new FieldSprites(game, scene);
  const shafts = new ShaftSprites(game, scene);
  const burial = new BurialSprites(game, scene);
  const furniture = new FurnitureSprites(game, scene);
  const green = new GreenSprites(game, scene);
  const light = new Firelight(game, scene);
  const bars = new WorkBars(game, scene);
  const wild = new WildSprites(game, scene);
  const wear = new WearLayer(game, scene);
  // The smoke has no handle on the renderer: this event centres the view on an animal and writes
  // where it stands on screen (canvas px) to `data-animal-at`.
  parent.addEventListener('vulcan:find-animal', (e) => {
    const kind = (e as CustomEvent<string | undefined>).detail;
    const first = wild.first(kind);
    if (!first) return;
    scene.controls?.lookAt(first.x, first.y);
    delete parent.dataset['animalAt'];
    // The camera's view is brought up to date as a frame is drawn.
    game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      const at = wild.first(kind) ?? first;
      const cam = scene.cameras.main;
      const px = [(at.x - cam.worldView.x) * cam.zoom, (at.y - cam.worldView.y) * cam.zoom];
      parent.dataset['animalAt'] = px.map(Math.round).join(',');
    });
  });
  return {
    setMapSize: (width, height, on) => {
      scene.setMapSize(width, height, on);
      build.setMapSize(width, height);
      fields.setMapSize(width);
      light.setMapSize(width, height);
      wild.setMapSize(width, height);
      wear.setMapSize(width, height);
    },
    applyChunks: (chunks) => {
      scene.applyChunks(chunks);
      build.applyChunks(chunks);
      wild.applyChunks(chunks);
      wear.applyChunks(chunks);
    },
    setAura: (spots) => scene.setAura(spots),
    zoomStep: (direction) => scene.zoomStep(direction),
    lookAt: (x, y) => scene.controls?.lookAt((x + 0.5) * TILE, (y + 0.5) * TILE),
    setTopInset: (px) => scene.setTopInset(px),
    setLevel: (z) => {
      scene.setLevel(z);
      people.setLevel(z);
      goods.setLevel(z);
      build.setLevel(z);
      fields.setLevel(z);
      shafts.setLevel(z);
      burial.setLevel(z);
      furniture.setLevel(z);
      green.setLevel(z);
      light.setLevel(z);
      bars.setLevel(z);
      wild.setLevel(z);
      wear.setLevel(z);
    },
    setPeople: (list) => people.set(list),
    personAt: (x, y) => people.at(x, y),
    movePeople: (walkers) => people.move(walkers),
    setAnimals: (list) => {
      wild.set(list);
      parent.dataset['animals'] = String(list.length);
    },
    animalAt: (x, y) => wild.at(x, y),
    setGoods: (view, sky) => {
      goods.set(view);
      build.setPlans(view.plans);
      fields.set(view.fields);
      shafts.set(view.shafts);
      burial.set(view);
      furniture.set(view.furniture);
      light.set(view.fires, sky.clock);
      bars.set(view.work, sky.skipping ? 3 : sky.speed);
      wild.setMiddens(view.middens);
    },
    setBuild: (view) => green.set(view),
    mark: (tile) => scene.mark(tile),
    thumbnail: () => thumbnailOf(game),
    fps: () => game.loop.actualFps,
    destroy: () => game.destroy(true),
  };
}

const THUMB = { width: 112, height: 80 };

// The renderer's snapshot, cropped to fill a small frame. A failure or a slow snapshot gives no
// picture rather than holding up the save.
function thumbnailOf(game: Phaser.Game): Promise<string> {
  return new Promise((resolve) => {
    const late = setTimeout(() => resolve(''), 1000);
    const finish = (url: string) => {
      clearTimeout(late);
      resolve(url);
    };
    const draw = (image: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB.width;
      canvas.height = THUMB.height;
      const g = canvas.getContext('2d');
      if (!g || !image.width || !image.height) return finish('');
      const scale = Math.max(THUMB.width / image.width, THUMB.height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      g.drawImage(image, (THUMB.width - w) / 2, (THUMB.height - h) / 2, w, h);
      finish(canvas.toDataURL('image/jpeg', 0.7));
    };
    try {
      game.renderer.snapshot((image) => {
        if (!(image instanceof HTMLImageElement)) return finish('');
        if (image.complete) draw(image);
        else image.onload = () => draw(image);
      });
    } catch {
      finish('');
    }
  });
}
