// The coat drawn on a villager outdoors in the cold (Seen at Work Part 3, V-190): the sheet's coat
// drawing of their villager (`person.<race>.v<n>.<art>.<facing>.<frame>`, PixelLab edits of each
// villager), and for a ragged or fine coat that drawing redrawn by coat-look.ts, made once into a
// small canvas texture of its own the first time anyone needs it. Which coat and look come from the
// worker's people view (GAME-02); this only draws them.
import Phaser from 'phaser';
import gpl from '../../art/palette.gpl?raw';
import type { CoatView } from '../worker/index.ts';
import { coatLook, readPalette } from './coat-look.ts';
import { PEOPLE } from './sheets.ts';

const palette = readPalette(gpl);

/** A texture and frame to draw a body with. */
export interface BodyFrame {
  key: string;
  frame?: string;
}

/** A small number from a name, so each drawing's tears sit in their own places. */
const hashOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export class CoatTextures {
  private pixels: ImageData | undefined;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Whether the sheet has coat drawings of `art` for villager `stem`. */
  has(stem: string, art: string): boolean {
    return this.scene.textures.get(PEOPLE).has(`${stem}.${art}.s.0`);
  }

  /** The body for villager `stem` in `coat`, facing and frame; the plain villager without one. */
  body(stem: string, coat: CoatView | undefined, facing: string, frame: number): BodyFrame {
    const bare = `${stem}.${facing}.${frame}`;
    if (!coat || !this.has(stem, coat.art)) return { key: PEOPLE, frame: bare };
    const drawn = `${stem}.${coat.art}.${facing}.${frame}`;
    if (coat.look === 'plain') return { key: PEOPLE, frame: drawn };
    const key = `coat|${drawn}|${coat.look}`;
    if (!this.scene.textures.exists(key)) this.make(key, bare, drawn, coat.look, `${stem}.${facing}`);
    return this.scene.textures.exists(key) ? { key } : { key: PEOPLE, frame: drawn };
  }

  private make(key: string, bare: string, drawn: string, look: 'ragged' | 'fine', seed: string) {
    const base = this.read(bare);
    const coat = this.read(drawn);
    if (!base || !coat) return;
    const canvas = this.scene.textures.createCanvas(key, coat.width, coat.height);
    if (!canvas) return;
    const out = coatLook(base.data, coat.data, coat.width, look, palette, hashOf(seed));
    canvas.context.putImageData(new ImageData(Uint8ClampedArray.from(out), coat.width, coat.height), 0, 0);
    canvas.refresh();
  }

  /** One frame's pixels, read from the sheet's image (drawn into a canvas once). */
  private read(name: string): { data: Uint8ClampedArray; width: number; height: number } | undefined {
    const texture = this.scene.textures.get(PEOPLE);
    if (!texture.has(name)) return undefined;
    if (!this.pixels) {
      const img = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const c = document.createElement('canvas');
      [c.width, c.height] = [img.width, img.height];
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0);
      this.pixels = ctx.getImageData(0, 0, c.width, c.height);
    }
    const f = texture.get(name);
    const [w, h] = [f.cutWidth, f.cutHeight];
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const from = ((f.cutY + y) * this.pixels.width + f.cutX) * 4;
      data.set(this.pixels.data.subarray(from, from + w * 4), y * w * 4);
    }
    return { data, width: w, height: h };
  }
}
