// Public surface of the render layer: boots Phaser with the valley scene and hands the page a
// small handle to feed it snapshots and drive the camera.
import Phaser from 'phaser';
import {
  TICKS_PER_SECOND,
  type AnimalView,
  type AuraView,
  type BuildView,
  type ChunkView,
  type ClockView,
  type FindMark,
  type GoodsView,
  type PersonView,
  type Speed,
  type WalkerView,
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
import { Bubbles } from './bubbles.ts';
import { Finder } from './finder.ts';
import { WildSprites } from './wild.ts';
import { WearLayer } from './wear.ts';
import { CanopyLayer } from './canopy.ts';
import { FlagLayer } from './flags.ts';
import { TrailClock } from './trail.ts';
import { TILE, ValleyScene, type Hover } from './scene.ts';

export type { Hover } from './scene.ts';
export { bodyStem, variantCounts } from './look.ts';

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
  /** Finds a person: where they stand now (tile and level), or undefined if not drawn at all. */
  placeOf(id: number): { x: number; y: number; z: number } | undefined;
  /** Centres the view on a tile between the bar and a sheet covering the bottom `below` px,
   * coming in to 1x if zoomed farther out; moves the camera only. */
  focus(x: number, y: number, below: number): void;
  /** Rings a person at their feet as they walk, pulsing once if `pulse`; undefined takes it off. */
  follow(id: number | undefined, pulse?: boolean): void;
  /** Rings and names everyone on the level on screen, or stops. */
  showNames(on: boolean): void;
  /** Draws the people on the level on screen (P2.1). */
  setPeople(people: readonly PersonView[]): void;
  /** The person standing on a tile of the level on screen, if any. */
  personAt(x: number, y: number): PersonView | undefined;
  /** Draws the live animals (the snapshot's `animals`, when sent) on the surface (Bundle 2). */
  setAnimals(animals: readonly AnimalView[]): void;
  /** The animal standing on a tile of the surface, if any: its id. */
  animalAt(x: number, y: number): number | undefined;
  /** Flags the found places (6W Slice 6). */
  setFinds(marks: readonly FindMark[]): void;
  /** Moves the people to where the latest snapshot (its tick and speed) stands them (P2.3); they
   * walk there a few game minutes behind, at the pace they really walked (trail.ts). */
  movePeople(
    walkers: readonly WalkerView[],
    at: { tick: number; speed: Speed; skipping: boolean },
  ): void;
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
  scene.hover.onHover = hooks.onHover;
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
  const l = layersOf(game, scene, parent);
  watchAnimalFinder(l);
  watchWorkFinder(l);
  return { ...viewHandle(l), ...peopleHandle(l), ...goodsHandle(l) };
}

/** The scene and every sprite layer drawn over it, made in drawing order. */
function layersOf(game: Phaser.Game, scene: ValleyScene, parent: HTMLElement) {
  const clock = new TrailClock();
  const people = new PeopleSprites(game, scene, clock);
  const goods = new GoodsSprites(game, scene);
  const build = new BuildSprites(game, scene);
  const fields = new FieldSprites(game, scene);
  const shafts = new ShaftSprites(game, scene);
  const burial = new BurialSprites(game, scene);
  const furniture = new FurnitureSprites(game, scene);
  const green = new GreenSprites(game, scene);
  const light = new Firelight(game, scene);
  const bars = new WorkBars(game, scene);
  const wild = new WildSprites(game, scene, clock);
  const wear = new WearLayer(scene);
  const canopy = new CanopyLayer(scene);
  const flags = new FlagLayer(game, scene);
  scene.window.layers.push(wear, canopy, wild);
  scene.spots = () => people.spots();
  const finder = new Finder(game, scene, () => people.spots());
  const bubbles = new Bubbles(game, scene, parent, () => people.spots());
  return {
    ...{ game, scene, parent, clock, people, goods, build, fields, shafts, burial, furniture },
    ...{ green, light, bars, wild, wear, canopy, flags, finder, bubbles },
  };
}

type Layers = ReturnType<typeof layersOf>;

/** Where a world point stands on screen, in canvas px, as "x,y". */
function onScreen(scene: ValleyScene, at: { x: number; y: number }): string {
  const cam = scene.cameras.main;
  return [(at.x - cam.worldView.x) * cam.zoom, (at.y - cam.worldView.y) * cam.zoom]
    .map(Math.round)
    .join(',');
}

/** The smoke has no handle on the renderer: this event centres the view on an animal and writes
 * where it stands on screen (canvas px) to `data-animal-at`. */
function watchAnimalFinder({ game, scene, parent, wild }: Layers): void {
  parent.addEventListener('vulcan:find-animal', (e) => {
    const kind = (e as CustomEvent<string | undefined>).detail;
    const first = wild.first(kind);
    if (!first) return;
    scene.controls?.lookAt(first.x, first.y);
    delete parent.dataset['animalAt'];
    // The camera's view is brought up to date as a frame is drawn.
    game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      parent.dataset['animalAt'] = onScreen(scene, wild.first(kind) ?? first);
    });
  });
}

/** Seen at work (V-194): centres on someone working with the named motion, then writes where
 * they stand, the bits in the air and how many hold a tool or a load (`data-*`). */
function watchWorkFinder({ game, scene, parent, people }: Layers): void {
  parent.addEventListener('vulcan:find-worker', (e) => {
    const motion = (e as CustomEvent<string | undefined>).detail;
    const first = people.working(motion);
    if (first) scene.controls?.lookAt(first.x, first.y);
    game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      const now = people.working(motion);
      if (now) parent.dataset['workerAt'] = onScreen(scene, now);
      else delete parent.dataset['workerAt'];
      parent.dataset['bits'] = String(people.bits);
      parent.dataset['tools'] = String(people.carrying.tools);
      parent.dataset['loads'] = String(people.carrying.loads);
    });
  });
}

/** The map, the camera and the level on screen. */
function viewHandle(l: Layers) {
  const { game, scene, build, fields, light, wild, wear, canopy, bubbles } = l;
  return {
    setMapSize: (width: number, height: number, on?: { x: number; y: number }) => {
      scene.setMapSize(width, height, on);
      build.setMapSize(width, height);
      fields.setMapSize(width);
      light.setMapSize(width, height);
      wild.setMapSize(width, height);
      wear.setMapSize();
      canopy.setMapSize();
    },
    applyChunks: (chunks: readonly ChunkView[]) => {
      scene.applyChunks(chunks);
      build.applyChunks(chunks);
      wild.applyChunks(chunks);
      wear.applyChunks(chunks);
      canopy.applyChunks(chunks);
    },
    setAura: (spots: readonly AuraView[]) => scene.setAura(spots),
    zoomStep: (direction: 1 | -1) => scene.zoomStep(direction),
    lookAt: (x: number, y: number) => scene.controls?.lookAt((x + 0.5) * TILE, (y + 0.5) * TILE),
    setTopInset: (px: number) => {
      scene.setTopInset(px);
      bubbles.setTopInset(px);
    },
    setLevel: (z: number) => {
      scene.setLevel(z);
      for (const layer of [l.people, l.goods, build, fields, l.shafts, l.burial, l.furniture])
        layer.setLevel(z);
      for (const layer of [l.green, light, l.bars, wild, wear, l.canopy, l.flags])
        layer.setLevel(z);
    },
    focus: (x: number, y: number, below: number) =>
      scene.controls?.focus((x + 0.5) * TILE, (y + 0.5) * TILE, below),
    mark: (tile: { x: number; y: number } | undefined) => scene.mark(tile),
    thumbnail: () => thumbnailOf(game),
    fps: () => game.loop.actualFps,
    destroy: () => game.destroy(true),
  };
}

/** The people and animals on screen, and finding them. */
function peopleHandle({ game, scene, parent, clock, people, wild, finder, bubbles }: Layers) {
  return {
    placeOf: (id: number) => people.place(id),
    follow: (id: number | undefined, pulse?: boolean) => {
      finder.follow(id, pulse);
      bubbles.follow(id);
      // For the find check: where the person stands on screen (canvas px) once the view is drawn.
      delete parent.dataset['found'];
      if (id !== undefined)
        game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          const at = people.spots().find((s) => s.id === id);
          if (at) parent.dataset['found'] = onScreen(scene, at);
        });
    },
    showNames: (on: boolean) => finder.showNames(on),
    setPeople: (list: readonly PersonView[]) => people.set(list),
    personAt: (x: number, y: number) => people.at(x, y),
    movePeople: (
      walkers: readonly WalkerView[],
      at: { tick: number; speed: Speed; skipping: boolean },
    ) => {
      clock.seen(at.tick, TICKS_PER_SECOND[at.speed], at.skipping);
      people.move(walkers);
      bubbles.setThoughts(walkers);
    },
    setAnimals: (list: readonly AnimalView[]) => {
      wild.set(list);
      parent.dataset['animals'] = String(list.length);
    },
    animalAt: (x: number, y: number) => wild.at(x, y),
  };
}

/** The goods, plans, buildings and fires each snapshot carries. */
function goodsHandle(l: Layers) {
  return {
    setGoods: (view: GoodsView, sky: { speed: Speed; skipping: boolean; clock: ClockView }) => {
      l.goods.set(view);
      l.build.setPlans(view.plans);
      l.fields.set(view.fields);
      l.scene.setFields(view.fields);
      l.shafts.set(view.shafts);
      l.burial.set(view);
      l.furniture.set(view.furniture);
      l.light.set(view.fires, view.lit, sky.clock);
      l.bars.set(view.work, sky.skipping ? 3 : sky.speed);
      l.wild.setMiddens(view.middens);
    },
    setBuild: (view: BuildView) => l.green.set(view),
    setFinds: (marks: readonly FindMark[]) => l.flags.set(marks, l.parent),
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
