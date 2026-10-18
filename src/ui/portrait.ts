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

/** A canvas showing `p` facing south, `scale` times the frame size; drawn once the sheet loads. */
export function portrait(p: PersonView, scale = 2): HTMLCanvasElement {
  const canvas = el('canvas', { class: 'portrait', 'aria-hidden': 'true' });
  canvas.width = canvas.height = SIZE;
  canvas.style.width = canvas.style.height = `${SIZE * scale}px`;
  void loadSheet().then((s) => {
    const g = canvas.getContext('2d');
    if (!s || !g) return;
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
  });
  return canvas;
}
