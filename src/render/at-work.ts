// Seen at work (V-190, V-194): the tool in a person's hand, the load in their arms and the drawn
// motion of the work they stand at, laid into their sprite's container. The worker says what
// (`WalkerView.act`, `held`, `load`); this only draws it: the tool turns about the hand, the body
// leans, dips or crouches, and bits fly at each strike (specks.ts). Strokes keep a steady real-time
// pace at every game speed and stop while paused. A picture choice only, never game state.
import Phaser from 'phaser';
import type { WalkerView } from '../worker/index.ts';
import { ITEMS } from './sheets.ts';
import { Specks } from './specks.ts';
import {
  BEATS,
  BEHIND,
  CARRY_ANGLE,
  crossed,
  gripOf,
  HAND,
  poseAt,
  strikeAt,
  TOOL_SIZE,
  type Grip,
  type Pose,
} from './work-math.ts';

/** What a person is seen doing this snapshot. */
export interface Seen {
  act?: WalkerView['act'] | undefined;
  held?: string | undefined;
  load?: string | undefined;
}

/** A person's sprite as at-work draws on it (people.ts `Shown`). */
export interface Dressed {
  id: number;
  box: Phaser.GameObjects.Container;
  /** The body and its overlays, moved together by a pose. */
  images: Phaser.GameObjects.Image[];
  hand?: Phaser.GameObjects.Container | undefined;
  tool?: Phaser.GameObjects.Image | undefined;
  load?: Phaser.GameObjects.Image | undefined;
  /** The stroke's phase last frame, to see a strike pass. */
  phase?: number | undefined;
}

/** How a person stands this frame: the way they face, and whether this is a walk frame that
 * lifts them a pixel (frame 2). */
export interface Stance {
  facing: 'n' | 'e' | 's' | 'w';
  bob: number;
}

/** The size a load's icon is drawn at, in sprite pixels; its middle sits at the stomach (Q4 A). */
const LOAD = { size: 18, x: 16, y: 20, ahead: 3 };

export class AtWork {
  private readonly specks: Specks;
  private readonly grips = new Map<string, Grip | undefined>();
  /** Seconds of real time the motions have run (paused time does not count). */
  private time = 0;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.specks = new Specks(scene);
  }

  /** Each frame, before the people: runs the clock and the bits `dt` seconds on unless paused. */
  tick(dt: number, paused: boolean): void {
    const run = paused ? 0 : Math.min(0.1, dt);
    this.time += run;
    this.specks.step(run);
  }

  get bits(): number {
    return this.specks.count;
  }

  /** Draws a person's tool, load and pose; `working` when they stand at the work of `seen.act`. */
  draw(d: Dressed, seen: Seen | undefined, stance: Stance): void {
    const act = seen?.act;
    const phase = act ? (this.time / BEATS[act.motion].period + ((d.id * 0.37) % 1)) % 1 : 0;
    const pose: Pose = act ? poseAt(act.motion, phase) : { dx: 0, dy: 0, squash: 0 };
    const sign = stance.facing === 'w' ? -1 : 1;
    for (const img of d.images) {
      img.setScale(1, (32 - pose.squash) / 32);
      img.setPosition(pose.dx * sign, pose.dy + pose.squash);
    }
    this.hold(d, seen, stance, pose);
    this.carry(d, seen?.load, stance);
    if (act?.effect && d.phase !== undefined)
      for (const mark of BEATS[act.motion].strikes)
        if (crossed(d.phase, phase, mark)) {
          const at = strikeAt(act.motion);
          const scale = d.box.scaleX;
          const lx = sign > 0 ? at.x : 32 - at.x;
          // Bits fly back towards the worker from a tool, ahead of them otherwise.
          const dir = BEATS[act.motion].angles ? -sign : sign;
          this.specks.throw(act.effect, d.box.x + lx * scale, d.box.y + at.y * scale, dir, at.up);
        }
    d.phase = act ? phase : undefined;
  }

  /** Drops what at-work added to a sprite (before it is destroyed or restyled lying). */
  clear(d: Dressed): void {
    d.hand?.destroy();
    d.load?.destroy();
    d.hand = d.tool = d.load = undefined;
    d.phase = undefined;
    for (const img of d.images) img.setScale(1).setPosition(0, 0);
  }

  /** The held tool: turned about the hand while working, carried upright while walking to work. */
  private hold(d: Dressed, seen: Seen | undefined, stance: Stance, pose: Pose): void {
    const frame = seen?.held;
    const grip = frame && this.gripOf(frame);
    if (!frame || !grip || seen?.load) {
      d.hand?.setVisible(false);
      return;
    }
    if (!d.hand || !d.tool) {
      d.tool = this.scene.add.image(0, 0, ITEMS, frame);
      d.hand = this.scene.add.container(0, 0, [d.tool]);
      d.box.add(d.hand);
    }
    if (d.tool.frame.name !== frame) d.tool.setFrame(frame);
    const g = this.gripOf(frame)!;
    const k = TOOL_SIZE / Math.max(g.box.w, g.box.h);
    const tool = pose.tool ?? { angle: CARRY_ANGLE, x: HAND.x, y: HAND.y + stance.bob };
    const sign = stance.facing === 'w' ? -1 : 1;
    d.tool
      .setOrigin(g.grip.x / d.tool.width, g.grip.y / d.tool.height)
      .setScale(k)
      .setAngle(tool.angle - g.head);
    d.hand
      .setVisible(true)
      .setPosition(sign > 0 ? tool.x : 32 - tool.x, tool.y)
      .setScale(sign, 1);
    // Behind the head on the lift, and behind the body when they walk away.
    const behind = stance.facing === 'n' || tool.angle < BEHIND;
    if (behind) d.box.sendToBack(d.hand);
    else d.box.bringToTop(d.hand);
  }

  /** The load at the stomach, ahead of them on the side they face, behind them walking away. */
  private carry(d: Dressed, frame: string | undefined, stance: Stance): void {
    if (!frame || !this.scene.textures.get(ITEMS).has(frame)) {
      d.load?.setVisible(false);
      return;
    }
    if (!d.load) {
      d.load = this.scene.add.image(0, 0, ITEMS, frame);
      d.box.add(d.load);
    }
    if (d.load.frame.name !== frame) d.load.setFrame(frame);
    const ahead = stance.facing === 'e' ? LOAD.ahead : stance.facing === 'w' ? -LOAD.ahead : 0;
    d.load
      .setVisible(true)
      .setDisplaySize(LOAD.size, LOAD.size)
      .setPosition(LOAD.x + ahead, LOAD.y + stance.bob);
    if (stance.facing === 'n') d.box.sendToBack(d.load);
    else d.box.bringToTop(d.load);
  }

  /** A tool icon's grip, read once from its pixels. */
  private gripOf(frame: string): Grip | undefined {
    if (this.grips.has(frame)) return this.grips.get(frame);
    const tex = this.scene.textures;
    const f = tex.get(ITEMS).has(frame) ? tex.getFrame(ITEMS, frame) : undefined;
    const grip =
      f && gripOf((x, y) => (tex.getPixel(x, y, ITEMS, frame)?.alpha ?? 0) > 0, f.width, f.height);
    this.grips.set(frame, grip);
    return grip;
  }
}
