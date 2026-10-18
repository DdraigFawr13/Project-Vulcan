// Small pictures of people for the page's cards (P2.1): the same frames, clothes and hair tints the
// map draws, laid together on a canvas from the `sprites-people` sheet.
import type { PersonView } from '../worker/index.ts';
import { el } from './dom.ts';

type Frames = Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
const SIZE = 32;

let sheet: Promise<{ image: HTMLImageElement; frames: Frames } | undefined> | undefined;

function loadSheet() {
  sheet ??= (async () => {
    try {
      const json = (await (await fetch('art/sprites-people.json')).json()) as { frames: Frames };
      const image = new Image();
      image.src = 'art/sprites-people.png';
      await image.decode();
      return { image, frames: json.frames };
    } catch {
      return undefined; // a card without a picture is still a card
    }
  })();
  return sheet;
}

/** A canvas showing `p` facing south, `scale` times the frame size; drawn once the sheet loads.
 * `head` crops to the head and shoulders, centred, for the strip's round faces. */
export function portrait(p: PersonView, scale = 2, head = false): HTMLCanvasElement {
  const canvas = el('canvas', { class: 'portrait', 'aria-hidden': 'true' });
  canvas.width = canvas.height = SIZE;
  canvas.style.width = canvas.style.height = `${SIZE * scale}px`;
  void loadSheet().then((s) => {
    const out = canvas.getContext('2d');
    if (!s || !out) return;
    const whole = head ? document.createElement('canvas') : canvas;
    whole.width = whole.height = SIZE;
    const g = head ? whole.getContext('2d')! : out;
    const layer = (name: string, tint?: string) => {
      const f = s.frames[name]?.frame;
      if (!f) return;
      if (!tint) return g.drawImage(s.image, f.x, f.y, f.w, f.h, 0, 0, SIZE, SIZE);
      // Multiply the grey overlay by its colour, keeping only the overlay's own pixels.
      const off = document.createElement('canvas');
      off.width = off.height = SIZE;
      const o = off.getContext('2d')!;
      o.drawImage(s.image, f.x, f.y, f.w, f.h, 0, 0, SIZE, SIZE);
      o.globalCompositeOperation = 'multiply';
      o.fillStyle = tint;
      o.fillRect(0, 0, SIZE, SIZE);
      o.globalCompositeOperation = 'destination-in';
      o.drawImage(s.image, f.x, f.y, f.w, f.h, 0, 0, SIZE, SIZE);
      g.drawImage(off, 0, 0);
    };
    layer(`person.${p.race}.s.0`);
    layer(`clothes.${p.race}.s.0`, p.look.clothes);
    if (p.look.hair) layer(`hair.${p.look.hair}.${p.race}.s`, p.look.hairColour);
    if (head) cropHead(whole, out);
  });
  return canvas;
}

/** Draws the head and shoulders of the figure on `whole` into `out`: a square a little wider than
 * the figure, from just above its top, centred across it. */
function cropHead(whole: HTMLCanvasElement, out: CanvasRenderingContext2D): void {
  const data = whole.getContext('2d')!.getImageData(0, 0, SIZE, SIZE).data;
  let [left, right, top] = [SIZE, -1, SIZE];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (data[(y * SIZE + x) * 4 + 3]! > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
      }
  if (right < 0) return;
  const side = Math.min(SIZE, Math.max(14, right - left + 3));
  const x = Math.max(0, Math.min(SIZE - side, Math.round((left + right + 1 - side) / 2)));
  const y = Math.max(0, Math.min(SIZE - side, top - 1));
  out.imageSmoothingEnabled = false;
  out.drawImage(whole, x, y, side, side, 0, 0, SIZE, SIZE);
}
