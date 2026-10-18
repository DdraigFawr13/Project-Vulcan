// The region map (P1.5), drawn for the picker and the Region panel: the worker's raster painted in
// the game's muted palette with peaks, trees and rivers, then names, site glyphs and valley markers
// as an SVG layer with tap areas of about 40 px. A picture only; it computes no game rule (GAME-02).
import { content } from '../content/index.ts';
import type { RegionView } from '../worker/index.ts';

type RegionSite = RegionView['sites'][number];

const NS = 'http://www.w3.org/2000/svg';
type Rgb = readonly [number, number, number];

/** The region's biomes in the game's muted earthy palette (ART.md), by content biome id. */
const BIOME: Readonly<Record<string, Rgb>> = {
  lake: [64, 86, 98],
  tundra: [150, 150, 138],
  taiga: [66, 80, 66],
  'temperate-forest': [72, 88, 58],
  grassland: [112, 118, 78],
  steppe: [146, 134, 94],
  desert: [170, 152, 112],
  savanna: [158, 140, 90],
  swamp: [80, 84, 64],
  alpine: [196, 194, 186],
};
const ROCK: Rgb = [112, 104, 94];
const RIVER: Rgb = [76, 104, 122];

/** Each race's site colour; none is the selection gold. */
export const RACE_COLOUR: Readonly<Record<string, string>> = {
  Human: '#e6dccb',
  Elf: '#7cc49a',
  Dwarf: '#8fb0d0',
  Orc: '#d0675a',
  Giant: '#b4a3e6',
  Halfling: '#e8c86e',
  Goblin: '#a8a04a',
};

/** A 7 by 7 glyph per site kind (region.json `kinds`). */
export const GLYPH: Readonly<Record<string, string>> = {
  village: 'M1 3h5v4H1z M0 3l3.5-3L7 3z',
  'glade-hall': 'M3 5h1v2H3z M3.5 0L7 5H0z',
  hold: 'M0 7L3.5 0L7 7z',
  'war-camp': 'M0 7L3.5 1L7 7z M3 0h2v1H3z',
  steading: 'M0 3h7v4H0z M0 3l3.5-3L7 3z',
  shire: 'M0 7a3.5 3.5 0 0 1 7 0z',
  warren: 'M1 4h5v3H1z',
};

export interface RegionMapOptions {
  /** The valley drawn as chosen (gold), if any. */
  selected?: number;
  /** Draws only the selected valley (the Region panel in play). */
  onlySelected?: boolean;
  onValley?(id: number): void;
  onSite?(site: RegionSite): void;
}

const svg = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/** Paints the raster: biome colour shaded by height, rock above the mountain line, a little grain;
 * then peaks and trees on a scattered lattice, then the rivers. */
function paint(view: RegionView): HTMLCanvasElement {
  const { width, height, scale, biome, height8 } = view.raster;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const mountain = Math.round(content.region.mountain * 255);
  const ids = content.biomes.biomes.map((b) => b.id);
  const forest = new Set(content.biomes.biomes.filter((b) => b.forest).map((b) => b.id));
  const put = (x: number, y: number, c: Rgb): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    image.data.set([c[0], c[1], c[2], 255], (y * width + x) * 4);
  };
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const id = ids[biome[i]!]!;
      let c = BIOME[id] ?? ROCK;
      if (height8[i]! > mountain && id !== 'alpine')
        c = c.map((v, k) => v * 0.45 + ROCK[k]! * 0.55) as unknown as Rgb;
      const shade = (0.9 + (0.2 * height8[i]!) / 255) * ((x * 3 + y * 5) % 13 === 0 ? 0.94 : 1);
      put(x, y, c.map((v) => Math.min(255, Math.round(v * shade))) as unknown as Rgb);
    }
  for (let cy = 0; cy < view.height; cy += 1)
    for (let cx = 0; cx < view.width; cx += 1) {
      const i = (cy * scale + 1) * width + cx * scale + 1;
      const e = height8[i]! / 255;
      const h =
        ((((cx * 374761393) ^ (cy * 668265263) ^ (cx * cy * 2246822519)) >>> 0) % 1000) / 1000;
      const [ox, oy] = [cx * scale, cy * scale];
      if (height8[i]! > mountain && h < 0.16 + (e - content.region.mountain)) {
        const tall = 5 + Math.round((e - content.region.mountain) * 10);
        for (let k = 0; k < tall; k += 1)
          for (let w = -k; w <= k; w += 1)
            put(
              ox + 2 + w,
              oy - tall + 3 + k,
              e > 0.8 && k < 2 ? [236, 236, 232] : w < 0 ? [146, 138, 124] : [88, 80, 72],
            );
      } else if (forest.has(ids[biome[i]!]!) && h < 0.33) {
        const leaf: Rgb = ids[biome[i]!] === 'taiga' ? [38, 54, 42] : [42, 60, 36];
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ] as const)
          put(ox + dx, oy + dy, leaf);
        put(ox + 1, oy + 2, [70, 52, 36]);
      }
    }
  for (const river of view.rivers)
    river.path.forEach(([x, y], k) => {
      if (k === 0) return;
      const [px, py] = river.path[k - 1]!;
      const wide = k > river.path.length / 2 ? 2 : 1;
      for (let s = 0; s <= scale; s += 1) {
        const rx = Math.round(px * scale + 1 + (x - px) * s);
        const ry = Math.round(py * scale + 1 + (y - py) * s);
        for (let a = 0; a <= wide; a += 1)
          for (let b = 0; b <= wide; b += 1) put(rx + a, ry + b, RIVER);
      }
    });
  ctx.putImageData(image, 0, 0);
  return canvas;
}

type Box = readonly [number, number, number, number];
const clear = (box: Box, boxes: Box[], width: number): boolean =>
  box[0] >= 1 &&
  box[2] <= width - 1 &&
  boxes.every((b) => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]);

/** The region map: a canvas under an SVG of names and markers, scaled to its container's width. */
export function regionMap(view: RegionView, options: RegionMapOptions = {}): HTMLElement {
  const s = view.raster.scale;
  const W = view.width * s;
  const H = view.height * s;
  const root = document.createElement('div');
  root.className = 'rmap';
  const layer = svg('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': `Region map of ${view.seed}`,
  });
  const image = svg('image', { width: W, height: H, href: paint(view).toDataURL() });
  image.setAttribute('style', 'image-rendering:pixelated');
  layer.append(image);
  const at = (x: number, y: number): [number, number] => [x * s + s / 2, y * s + s / 2];
  const boxes: Box[] = [
    ...view.sites.map((t) => {
      const [x, y] = at(t.x, t.y);
      return [x - 4, y - 4, x + 4, y + 4] as Box;
    }),
    ...view.valleys.map((v) => {
      const [x, y] = at(v.x, v.y);
      return [x - 10, y - 10, x + 10, y + 10] as Box;
    }),
  ];
  const text = (x: number, y: number, words: string, cls: string, anchor = 'middle') => {
    const t = svg('text', { x, y, 'text-anchor': anchor, class: cls });
    t.textContent = words;
    layer.append(t);
  };
  for (const g of view.ranges) {
    const [x, y] = at(g.x, g.y);
    const w = g.name.length * 4.4;
    boxes.push([x - w / 2, y - 7, x + w / 2, y + 2]);
    text(x, y, g.name, 'geo');
  }
  for (const river of view.rivers) {
    const [px, py] = river.path[Math.floor(river.path.length / 2)]!;
    const w = river.name.length * 4.4;
    const x = Math.min(Math.max(px * s, w / 2 + 2), W - 2 - w / 2);
    const y = Math.min(Math.max(py * s - 3, 9), H - 4);
    const box: Box = [x - w / 2, y - 7, x + w / 2, y + 2];
    if (clear(box, boxes, W)) {
      boxes.push(box);
      text(x, y, river.name, 'geo river');
    }
  }
  for (const site of view.sites) {
    const [x, y] = at(site.x, site.y);
    const g = svg('g', {
      class: 'site',
      tabindex: 0,
      role: 'button',
      'aria-label': `${site.name}, ${site.culture} ${site.kind}`,
    });
    g.append(svg('circle', { cx: x, cy: y, r: 14, fill: 'transparent' }));
    g.append(
      svg('path', {
        d: GLYPH[site.kind] ?? GLYPH['village']!,
        transform: `translate(${x - 3.5},${y - 3.5})`,
        fill: RACE_COLOUR[site.race] ?? '#ccc',
        class: 'glyph',
      }),
    );
    g.addEventListener('click', () => options.onSite?.(site));
    layer.append(g);
    // The name goes on the side with room, or is left off (the glyph still answers a tap).
    const w = site.name.length * 4.6 + 2;
    for (const anchor of x > W * 0.75 ? ['end', 'start'] : ['start', 'end']) {
      const x0 = anchor === 'start' ? x + 5 : x - 5 - w;
      const box: Box = [x0, y - 5, x0 + w, y + 5];
      if (!clear(box, boxes, W)) continue;
      boxes.push(box);
      text(anchor === 'start' ? x + 5 : x - 5, y + 3, site.name, 'lab', anchor);
      break;
    }
  }
  for (const v of view.valleys) {
    if (options.onlySelected && v.id !== options.selected) continue;
    const [x, y] = at(v.x, v.y);
    const on = v.id === options.selected;
    const g = svg('g', {
      class: `valley${on ? ' on' : ''}`,
      tabindex: 0,
      role: 'button',
      'aria-label': `Valley ${v.id}, ${v.name}`,
      'data-testid': `valley-${v.id}`,
    });
    g.append(svg('circle', { cx: x, cy: y, r: 17, fill: 'transparent' }));
    g.append(svg('circle', { cx: x, cy: y, r: on ? 9 : 7, class: 'ring' }));
    const n = svg('text', { x, y: y + 3.5, 'text-anchor': 'middle', class: 'num' });
    n.textContent = String(v.id);
    g.append(n);
    g.addEventListener('click', () => options.onValley?.(v.id));
    layer.append(g);
  }
  root.append(layer);
  return root;
}

/** The race legend under a map. */
export function raceLegend(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'legend';
  for (const [race, colour] of Object.entries(RACE_COLOUR)) {
    const item = document.createElement('span');
    const dot = document.createElement('i');
    dot.style.background = colour;
    item.append(dot, race);
    row.append(item);
  }
  return row;
}

const PLURAL: Readonly<Record<string, string>> = { Elf: 'Elves', Dwarf: 'Dwarves' };
/** "Eriana, a Lissari village · Humans · rule: queendom · faith: The Hearth". */
export const siteWords = (site: RegionSite): string =>
  `${site.name}, a ${site.culture} ${site.kind} · ${PLURAL[site.race] ?? `${site.race}s`} · rule: ${site.government} · faith: ${site.faith}`;
