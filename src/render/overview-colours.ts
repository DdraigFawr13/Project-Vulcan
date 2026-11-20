// The overview's colours (docs/MAP_OVERVIEW.md "Its look: tile colours"): each tile in the
// average colour of its own art, a feature (a tree, a boulder) laid over its ground by how much
// of the tile it covers, so woods read darker than grass; snow, ice and water from their own
// art; unknown rock black, a vein glinting through it. Colours are read once from the packed
// sheets; a picture choice only.
import type Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { LevelArrays } from './chunk-store.ts';
import { BUILDINGS } from './sheets.ts';

/** Red, green, blue and alpha, 0 to 255. */
export type Rgba = [number, number, number, number];

/** A colour and the share (0 to 1) of its tile it covers. */
interface Paint {
  rgb: Rgba;
  cover: number;
}

export interface Colours {
  /** By terrain kind index: the kind's own ground colour. */
  kinds: Rgba[];
  /** By features index: the feature's colour over its ground. */
  features: (Paint | undefined)[];
  /** By `buildings.parts` index. */
  parts: (Paint | undefined)[];
  /** Per features index: whether it is a vein, which glints through the dark. */
  veins: boolean[];
  glint: number;
  /** Snow-capped rock, lying snow and ice. */
  snow: Rgba;
  lying: Paint;
  ice: Rgba;
  /** A field frame's colour, or undefined if the sheet lacks it. */
  field(frame: string): Rgba | undefined;
}

const BLACK: Rgba = [0, 0, 0, 255];
const NONE: Paint = { rgb: BLACK, cover: 0 };

/** `top` laid over `base` at `share`. */
export const mix = (base: Rgba, top: Rgba, share: number): Rgba => [
  Math.round(base[0] + (top[0] - base[0]) * share),
  Math.round(base[1] + (top[1] - base[1]) * share),
  Math.round(base[2] + (top[2] - base[2]) * share),
  255,
];

/** Tile `i`'s colour on the overview of `level`. */
export function overColour(c: Colours, level: LevelArrays, i: number): Rgba {
  const thing = level.things[i]!;
  const feature = thing ? c.features[thing - 1] : undefined;
  if (!level.known[i]) {
    const vein = feature && c.veins[thing - 1];
    return vein ? mix(BLACK, feature.rgb, feature.cover * c.glint) : BLACK;
  }
  let colour = level.ice[i] ? c.ice : level.snow[i] ? c.snow : (c.kinds[level.ground[i]!] ?? BLACK);
  if (level.snowLie[i]) colour = mix(colour, c.lying.rgb, c.lying.cover);
  const part = level.built[i] ? c.parts[level.built[i]! - 1] : undefined;
  if (part) colour = mix(colour, part.rgb, part.cover);
  if (feature) colour = mix(colour, feature.rgb, feature.cover);
  return colour;
}

/** Reads the average colours from the loaded sheets. */
export function readColours(
  textures: Phaser.Textures.TextureManager,
  ground: readonly string[],
  nature: string,
): Colours {
  const reader = new FrameReader(textures);
  const groundPaint = (name: string): Paint => {
    const sheet = ground.find((s) => textures.get(s).has(name));
    return sheet ? reader.paint(sheet, name) : NONE;
  };
  const solid = (p: Paint): Rgba => mix(BLACK, p.rgb, p.cover);
  const kinds = content.terrain.kinds.map((k) => {
    const all = Array.from({ length: k.variants }, (_, v) =>
      solid(groundPaint(`${k.art}.${v + 1}`)),
    );
    return all.reduce((a, b, n) => mix(a, b, 1 / (n + 1)));
  });
  const features = content.features.map((f) =>
    textures.get(nature).has(`${f.art}.1`) ? reader.paint(nature, `${f.art}.1`) : undefined,
  );
  const built = textures.exists(BUILDINGS) ? textures.get(BUILDINGS) : undefined;
  const parts = content.buildings.parts.map((p) => {
    const name = built?.getFrameNames().find((n) => n === p.art || n.startsWith(`${p.art}.`));
    return name ? reader.paint(BUILDINGS, name) : undefined;
  });
  const fields = new Map<string, Rgba | undefined>();
  return {
    kinds,
    features,
    parts,
    veins: content.features.map((f) => f.kind === 'vein'),
    glint: content.terrain.generator.underground.fogVein,
    snow: solid(groundPaint(`${content.terrain.generator.rock.snowArt}.1`)),
    lying: groundPaint('tile.snow.1'),
    ice: solid(groundPaint('tile.ice.1')),
    field(frame) {
      if (!fields.has(frame))
        fields.set(frame, built?.has(frame) ? solid(reader.paint(BUILDINGS, frame)) : undefined);
      return fields.get(frame);
    },
  };
}

/** Averages frames of the packed sheets, drawing each sheet to a canvas once. */
class FrameReader {
  private readonly sheets = new Map<string, CanvasRenderingContext2D | undefined>();
  private readonly textures: Phaser.Textures.TextureManager;

  constructor(textures: Phaser.Textures.TextureManager) {
    this.textures = textures;
  }

  /** The alpha-weighted average colour of a frame and the share of its pixels it covers. */
  paint(sheet: string, name: string): Paint {
    const g = this.context(sheet);
    const frame = this.textures.get(sheet).get(name);
    if (!g || !frame.cutWidth || !frame.cutHeight) return NONE;
    const { data } = g.getImageData(frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
    let [r, gr, b, a] = [0, 0, 0, 0];
    for (let k = 0; k < data.length; k += 4) {
      const alpha = data[k + 3]!;
      r += data[k]! * alpha;
      gr += data[k + 1]! * alpha;
      b += data[k + 2]! * alpha;
      a += alpha;
    }
    if (!a) return NONE;
    const rgb: Rgba = [Math.round(r / a), Math.round(gr / a), Math.round(b / a), 255];
    return { rgb, cover: a / 255 / (data.length / 4) };
  }

  private context(sheet: string): CanvasRenderingContext2D | undefined {
    if (this.sheets.has(sheet)) return this.sheets.get(sheet);
    const source = this.textures.get(sheet).getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const g = canvas.getContext('2d', { willReadFrequently: true }) ?? undefined;
    g?.drawImage(source, 0, 0);
    this.sheets.set(sheet, g);
    return g;
  }
}
