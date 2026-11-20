// The coat drawn on a villager outdoors in the cold (Seen at Work Part 3, V-190): the sheet's coat
// drawing of their villager (`person.<race>.v<n>.<art>.<facing>.<frame>`, PixelLab edits of each
// villager), and for a ragged or fine coat that drawing redrawn by coat-look.ts, made once into a
// small canvas texture of its own the first time anyone needs it. Which coat and look come from the
// worker's people view (GAME-02); this only draws them.
import Phaser from 'phaser';
import type { CoatView } from '../worker/index.ts';
import { coatLook, sheetColours } from './coat-look.ts';
import { PEOPLE } from './sheets.ts';

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
  /** The sheet's own colours: all from the game's palette, so every look stays on it. */
  private palette: ReturnType<typeof sheetColours> = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** How many walk steps follow a coat drawing's standing frame (2 drawn, up to 7 from PixelLab). */
  private steps(name: string): number {
    const tex = this.scene.textures.get(PEOPLE);
    let n = 1;
    while (tex.has(`${name}.${n + 1}`)) n++;
    return n;
  }

  /** Whether the sheet has coat drawings of `art` for villager `stem`. */
  has(stem: string, art: string): boolean {
    return this.scene.textures.get(PEOPLE).has(`${stem}.${art}.s.0`);
  }

  /** The body for villager `stem` in `coat`, facing and frame; the plain villager without one. */
  body(stem: string, coat: CoatView | undefined, facing: string, frame: number): BodyFrame {
    if (!coat || !this.has(stem, coat.art))
      return { key: PEOPLE, frame: `${stem}.${facing}.${frame}` };
    // A plain coat with its own walk (PixelLab, most cloak facings) cycles its own steps. Otherwise,
    // and always for a ragged or fine look (worked out on the standing frames, whose bodies match),
    // a walk shows the coat's two drawn steps: step 1 is the standing coat a pixel up.
    const steps = this.steps(`${stem}.${coat.art}.${facing}`);
    const walks = coat.look === 'plain' && steps > 2;
    const step = frame === 0 ? 0 : 1 + ((frame - 1) % (walks ? steps : 2));
    const drawn = `${stem}.${coat.art}.${facing}.${step}`;
    if (coat.look === 'plain') return { key: PEOPLE, frame: drawn };
    const key = `coat|${drawn}|${coat.look}`;
    if (!this.scene.textures.exists(key))
      this.make(key, `${stem}.${facing}`, `${stem}.${coat.art}.${facing}`, coat.look, step === 1);
    return this.scene.textures.exists(key) ? { key } : { key: PEOPLE, frame: drawn };
  }

  private make(key: string, bare: string, drawn: string, look: 'ragged' | 'fine', up: boolean) {
    const base = this.read(`${bare}.0`);
    const coat = this.read(`${drawn}.0`);
    if (!base || !coat) return;
    const canvas = this.scene.textures.createCanvas(key, coat.width, coat.height);
    if (!canvas) return;
    const out = coatLook(base.data, coat.data, coat.width, look, this.palette, hashOf(bare));
    canvas.context.putImageData(
      new ImageData(Uint8ClampedArray.from(out), coat.width, coat.height),
      0,
      up ? -1 : 0,
    );
    canvas.refresh();
  }

  /** One frame's pixels, read from the sheet's image (drawn into a canvas once). */
  private read(
    name: string,
  ): { data: Uint8ClampedArray; width: number; height: number } | undefined {
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
      this.palette = sheetColours(this.pixels.data);
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

/** The browser check of the coats has no cold to wait for: `vulcan:try-coat` on the page's
 * `#game` dresses everyone in one CoatView (none undresses), and `data-coats` says how many. */
export function watchCoatTrial(
  game: Phaser.Game,
  parent: HTMLElement,
  people: { tryCoat(coat: CoatView | undefined): number },
): void {
  parent.addEventListener('vulcan:try-coat', (e) => {
    const coat = (e as CustomEvent<CoatView | undefined>).detail;
    game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      parent.dataset['coats'] = String(people.tryCoat(coat));
    });
  });
}
