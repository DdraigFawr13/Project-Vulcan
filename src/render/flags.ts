// Flags on found places (6W Slice 6, V-213): one small rubric flag, drawn here and not from a
// sheet, on each place the colony has found, at both zooms. Close in it stands on its tile with
// the art; zoomed out past 1x it keeps its 1x size on screen, over the overview picture and under
// the people's dots. Surface only. View only: tapping the tile opens its page as any tile does.
import Phaser from 'phaser';
import type { FindMark } from '../worker/index.ts';
import { TILE } from './frames.ts';
import { tokenColour } from './tokens.ts';

/** Over the tree crowns (8.3), under the night's shade (8.5). */
const NEAR = 8.45;
/** Over the overview picture (20), under the dots (21). */
const FAR = 20.5;

export class FlagLayer {
  private readonly scene: Phaser.Scene;
  private g: Phaser.GameObjects.Graphics | undefined;
  private marks: readonly FindMark[] = [];
  private z = 0;
  /** The zoom the flags were last drawn for (they keep their size below 1x). */
  private drawnAt = 0;
  private rubric = 0;
  private ink = 0;
  private pole = 0;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.g = scene.add.graphics().setDepth(NEAR);
        this.rubric = tokenColour('--rubric', '#8e2f22');
        this.ink = tokenColour('--ink', '#2b2016');
        this.pole = tokenColour('--oak', '#4a3322');
        scene.events.on(Phaser.Scenes.Events.UPDATE, () => this.frame());
      }),
    );
  }

  /** The flags, also written to `parent`'s `data-flags` ("x,y x,y") for the browser check. */
  set(marks: readonly FindMark[], parent: HTMLElement): void {
    this.marks = marks;
    this.drawnAt = 0;
    parent.dataset['flags'] = marks.map((m) => `${m.x},${m.y}`).join(' ');
  }

  setLevel(z: number): void {
    this.z = z;
    this.g?.setVisible(z === 0);
  }

  private frame(): void {
    const g = this.g;
    if (!g || this.z !== 0) return;
    const zoom = this.scene.cameras.main.zoom;
    const scale = 1 / Math.min(1, zoom);
    if (scale === this.drawnAt) return;
    this.drawnAt = scale;
    g.clear().setDepth(zoom < 0.5 ? FAR : NEAR);
    // In map px at 1x: a pole 2 wide, 14 tall, from the tile's middle, and a 9 by 6 flag at its top.
    const u = scale;
    for (const { x, y } of this.marks) {
      const px = (x + 0.5) * TILE;
      const py = (y + 0.5) * TILE;
      g.fillStyle(this.ink, 1).fillRect(px - 2 * u, py - 15 * u, 4 * u, 16 * u);
      g.fillStyle(this.pole, 1).fillRect(px - u, py - 14 * u, 2 * u, 14 * u);
      g.fillStyle(this.ink, 1).fillRect(px - u, py - 15 * u, 11 * u, 8 * u);
      g.fillStyle(this.rubric, 1).fillRect(px, py - 14 * u, 9 * u, 6 * u);
    }
  }
}
