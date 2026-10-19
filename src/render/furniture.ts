// Furniture on the map (P3.4): each piece from the `buildings` sheet over the floor and under the
// people, a planned one drawn faint like a part plan. The worker names a piece's art and facing;
// a frame for that facing (`furn.bed.v`, `furn.chair.e`) is used when the sheet has one, else the
// plain art (`furn.table`). A lit hearth (`furn.hearth.lit`) has numbered frames (`.1` to `.3`)
// that the flames cycle through. Redrawn only when the pieces change.
import Phaser from 'phaser';
import type { GoodsView } from '../worker/index.ts';
import { BUILDINGS } from './sheets.ts';

const TILE = 32;
const PLAN_ALPHA = 0.5;
// Over the floors (4) and the store (5), with the items lying about (6), under the people (8).
const DEPTH = 6;
/** Milliseconds a flame frame stays. */
const FLAME_MS = 170;

export class FurnitureSprites {
  private pieces: GoodsView['furniture'] = [];
  private shown: Phaser.GameObjects.Image[] = [];
  /** Lit hearths: their sprite and the frames to cycle, each starting at its own place. */
  private flames: { image: Phaser.GameObjects.Image; frames: string[]; start: number }[] = [];
  private key = '';
  private z = 0;
  private live = false;

  private readonly scene: Phaser.Scene;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        scene.time.addEvent({ delay: FLAME_MS, loop: true, callback: () => this.flicker() });
        this.draw();
      }),
    );
  }

  set(pieces: GoodsView['furniture']): void {
    this.pieces = pieces;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(BUILDINGS)) return;
    const here = this.pieces.filter((p) => p.z === this.z);
    const key = JSON.stringify([this.z, here]);
    if (key === this.key) return;
    this.key = key;
    for (const s of this.shown) s.destroy();
    this.shown = [];
    this.flames = [];
    const sheet = this.scene.textures.get(BUILDINGS);
    for (const p of here) {
      const facing = `${p.art}.${p.facing}`;
      const base = sheet.has(facing) ? facing : p.art;
      // Flames: numbered frames of the art (`furn.hearth.lit.1` to `.3`), when the sheet has them.
      const flames = [1, 2, 3].map((n) => `${base}.${n}`).filter((f) => sheet.has(f));
      const frame = sheet.has(base) ? base : flames[0];
      if (!frame) continue;
      const image = this.scene.add
        .image(p.x * TILE, p.y * TILE, BUILDINGS, frame)
        .setOrigin(0)
        .setDepth(DEPTH);
      if (p.plan) image.setAlpha(PLAN_ALPHA);
      this.shown.push(image);
      if (flames.length) {
        this.flames.push({ image, frames: flames, start: p.x + p.y });
        image.setFrame(flames[(p.x + p.y) % flames.length]!);
      }
    }
  }

  /** Moves each lit hearth's flames on a frame. */
  private flicker(): void {
    for (const f of this.flames) {
      f.start += 1;
      f.image.setFrame(f.frames[f.start % f.frames.length]!);
    }
  }
}
