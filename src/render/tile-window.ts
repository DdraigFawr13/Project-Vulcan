// The window of tiles kept as tile layers (Phase 6W Slice 2, docs/MAP_OVERVIEW.md): only the
// chunks near the camera, not the whole map, so a bigger map costs a phone no more memory or
// frame time. The window is chunk-aligned and big enough for the screen at the overview line
// (½×) plus a chunk all round; it moves, and its layers repaint, when the view leaves it.
// View state only: nothing here is game state.
import type Phaser from 'phaser';
import type { ChunkView } from '../worker/index.ts';
import { TILE } from './frames.ts';

/** The worker's chunk side, in tiles (engine `CHUNK`). */
export const CHUNK = 16;
/** Below this zoom the map is the overview picture, not tiles. */
export const OVERVIEW_ZOOM = 0.5;

/** A rectangle of tiles. */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The window's size in tiles for a `screen` (px) on a map `map` (tiles): the screen at the
 * overview line, rounded out to whole chunks, a chunk either side, never more than the map. */
export function spanFor(
  screen: { width: number; height: number },
  map: { width: number; height: number },
): { w: number; h: number } {
  const side = (px: number, tiles: number): number => {
    const chunks = Math.ceil(px / (TILE * OVERVIEW_ZOOM) / CHUNK) + 3;
    return Math.min(chunks, Math.ceil(tiles / CHUNK)) * CHUNK;
  };
  return { w: side(screen.width, map.width), h: side(screen.height, map.height) };
}

/** Whether the tiles of `view` (fractional tiles), clipped to the map, all lie inside `area`. */
export function covers(area: Area, view: Area, map: { width: number; height: number }): boolean {
  const x0 = Math.max(0, Math.floor(view.x));
  const y0 = Math.max(0, Math.floor(view.y));
  const x1 = Math.min(map.width, Math.ceil(view.x + view.w));
  const y1 = Math.min(map.height, Math.ceil(view.y + view.h));
  return x0 >= area.x && y0 >= area.y && x1 <= area.x + area.w && y1 <= area.y + area.h;
}

/** The chunk-aligned window of size `span` centred as near as it can be on `view`'s middle. */
export function areaFor(
  view: Area,
  span: { w: number; h: number },
  map: { width: number; height: number },
): Area {
  const place = (mid: number, size: number, tiles: number): number => {
    const most = Math.max(0, Math.ceil(tiles / CHUNK) * CHUNK - size);
    return Math.min(most, Math.max(0, Math.round((mid - size / 2) / CHUNK) * CHUNK));
  };
  return {
    x: place(view.x + view.w / 2, span.w, map.width),
    y: place(view.y + view.h / 2, span.h, map.height),
    w: span.w,
    h: span.h,
  };
}

/** One layer of a window: its depth. Every layer can use every sheet of its window. */
export interface LayerSpec {
  depth: number;
}

/** A set of tile layers the size of the window, laid at its corner. Positions passed in are
 * map tiles; ones outside the window are skipped. */
export class WindowTiles {
  private map: Phaser.Tilemaps.Tilemap | undefined;
  private layers: Phaser.Tilemaps.TilemapLayer[] = [];
  area: Area = { x: 0, y: 0, w: 0, h: 0 };
  /** The first gid of each sheet, by sheet key. */
  readonly gids = new Map<string, number>();
  private wanted = true;
  private shown = true;

  private readonly scene: Phaser.Scene;
  private readonly sheets: readonly string[];
  private readonly specs: readonly LayerSpec[];

  constructor(scene: Phaser.Scene, sheets: readonly string[], specs: readonly LayerSpec[]) {
    this.scene = scene;
    this.sheets = sheets;
    this.specs = specs;
  }

  get ready(): boolean {
    return this.layers.length > 0;
  }

  /** Makes the layers for `area`'s size (when it changed) or blanks them, and lays them there. */
  place(area: Area): void {
    if (!this.map || area.w !== this.area.w || area.h !== this.area.h) this.make(area);
    else for (const layer of this.layers) layer.fill(-1);
    this.area = area;
    for (const layer of this.layers) layer.setPosition(area.x * TILE, area.y * TILE);
  }

  private make(area: Area): void {
    this.map?.destroy();
    const map = this.scene.make.tilemap({
      tileWidth: TILE,
      tileHeight: TILE,
      width: area.w,
      height: area.h,
    });
    let gid = 0;
    const sets = this.sheets.map((sheet) => {
      const set = map.addTilesetImage(sheet, sheet, TILE, TILE, 1, 2, gid);
      if (!set) throw new Error(`The ${sheet} sheet did not load.`);
      this.gids.set(sheet, gid);
      gid += set.total;
      return set;
    });
    this.layers = this.specs.map((spec, k) => {
      const layer = map.createBlankLayer(`layer${k}`, sets, 0, 0, area.w, area.h);
      if (!layer) throw new Error('The map layers could not be made.');
      return layer.setDepth(spec.depth);
    });
    this.map = map;
    this.apply();
  }

  /** Whether the window's owner wants it drawn (its level), apart from the overview. */
  setWanted(on: boolean): void {
    this.wanted = on;
    this.apply();
  }

  /** Hidden under the overview picture. */
  setShown(on: boolean): void {
    this.shown = on;
    this.apply();
  }

  private apply(): void {
    for (const layer of this.layers) layer.setVisible(this.wanted && this.shown);
  }

  /** Whether map tile (x, y) is in the window. */
  has(x: number, y: number): boolean {
    const a = this.area;
    return x >= a.x && y >= a.y && x < a.x + a.w && y < a.y + a.h;
  }

  /** Puts tile `index` (-1 for none) at map tile (x, y) of layer `k`; returns the tile. */
  put(k: number, index: number, x: number, y: number): Phaser.Tilemaps.Tile | undefined {
    const layer = this.layers[k];
    if (!layer || !this.has(x, y)) return undefined;
    const [lx, ly] = [x - this.area.x, y - this.area.y];
    if (index < 0) {
      layer.removeTileAt(lx, ly);
      return undefined;
    }
    return layer.putTileAt(index, lx, ly) ?? undefined;
  }

  /** The tile at map (x, y) of layer `k`, if it is in the window and not blank. */
  tile(k: number, x: number, y: number): Phaser.Tilemaps.Tile | undefined {
    if (!this.has(x, y)) return undefined;
    return this.layers[k]?.getTileAt(x - this.area.x, y - this.area.y) ?? undefined;
  }

  /** Blanks layer `k`. */
  blank(k: number): void {
    this.layers[k]?.fill(-1);
  }

  /** Writes `rows` (already clipped to the window) to layer `k` with its corner at map (x, y). */
  putRows(k: number, rows: number[][], x: number, y: number): void {
    const layer = this.layers[k];
    if (layer && rows.length) layer.putTilesAt(rows, x - this.area.x, y - this.area.y);
  }

  /** The part of `rect` inside the window, or undefined if none. */
  clip(rect: Area): Area | undefined {
    const a = this.area;
    const x = Math.max(a.x, rect.x);
    const y = Math.max(a.y, rect.y);
    const w = Math.min(a.x + a.w, rect.x + rect.w) - x;
    const h = Math.min(a.y + a.h, rect.y + rect.h) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : undefined;
  }

  destroy(): void {
    this.map?.destroy();
    this.map = undefined;
    this.layers = [];
  }
}

/** The latest copy of each surface chunk, so a moved window can repaint from memory. */
export class HeldChunks {
  private readonly byKey = new Map<string, ChunkView>();

  keep(chunk: ChunkView): void {
    this.byKey.set(`${chunk.x},${chunk.y}`, chunk);
  }

  clear(): void {
    this.byKey.clear();
  }

  /** The chunks that overlap `area`. */
  within(area: Area): ChunkView[] {
    return [...this.byKey.values()].filter(
      (c) =>
        c.x < area.x + area.w && c.y < area.y + area.h && c.x + c.w > area.x && c.y + c.h > area.y,
    );
  }
}

/** A layer drawn for the window near the camera: told when it moves and when the overview shows. */
export interface WindowLayer {
  place(area: Area): void;
  show(on: boolean): void;
}

/** What the window needs of the camera. */
interface View {
  width: number;
  height: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
}

/** Moves the window with the view and swaps the tiles for the overview past ½×, telling each
 * layer (the scene's own first, then wear, snow and crowns). */
export class WindowFollower {
  readonly layers: WindowLayer[] = [];
  area: Area = { x: 0, y: 0, w: 0, h: 0 };
  far = false;

  /** A new map: the window is placed afresh on the next frame. */
  reset(): void {
    this.area = { x: 0, y: 0, w: 0, h: 0 };
  }

  /** Each frame, before drawing: `cam` as it will be drawn (worldView is only updated then). */
  update(cam: View, map: { width: number; height: number }): void {
    const far = cam.zoom < OVERVIEW_ZOOM;
    if (far !== this.far) {
      this.far = far;
      for (const layer of this.layers) layer.show(!far);
    }
    if (far) return;
    const [w, h] = [cam.width / cam.zoom, cam.height / cam.zoom];
    const view = {
      x: (cam.scrollX + (cam.width - w) / 2) / TILE,
      y: (cam.scrollY + (cam.height - h) / 2) / TILE,
      w: w / TILE,
      h: h / TILE,
    };
    const span = spanFor(cam, map);
    const same = span.w === this.area.w && span.h === this.area.h;
    if (same && covers(this.area, view, map)) return;
    this.area = areaFor(view, span, map);
    for (const layer of this.layers) layer.place(this.area);
  }
}
