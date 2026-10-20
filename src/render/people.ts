// The people on the map (P2.1): each a body from the `sprites-people` sheet with their clothes and
// hair laid over it, tinted to the colours drawn for them. Since P2.3 they walk: each snapshot
// moves them to the tile their row says, and on screen they glide there, facing the way they go
// with their two walk frames, then stand. The glide is a picture choice, never game state.
import Phaser from 'phaser';
import type { PersonView, WalkerView } from '../worker/index.ts';
import { PEOPLE } from './sheets.ts';

const TILE = 32;
// People are drawn a quarter larger than a tile (V-095): centred across it, feet on its lower
// edge, so a head may overlap the tile above.
const SIZE = 1.25;
const LIFT_X = -(TILE * (SIZE - 1)) / 2;
const LIFT_Y = -TILE * (SIZE - 1);
/** Gliding: at least this many screen pixels a second (a tile a game minute at 1x), and never
 * more than about a tenth of a second behind, so at 3x nobody trails their tile. */
const GLIDE = 320;
const CATCH_UP = 100;
/** Milliseconds per walk frame. */
const STRIDE = 160;
/** The unburied dead are drawn grey (P5.8); a carried person lies a few pixels off their carrier. */
const GREY = 0x8a8a8a;
const CARRIED = { x: 4, y: 7 };

const colour = (hex: string): number => Number.parseInt(hex.slice(1), 16);

type Facing = 'n' | 'e' | 's' | 'w';

interface Shown {
  view: PersonView;
  box: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  clothes: Phaser.GameObjects.Image;
  hair: Phaser.GameObjects.Image | undefined;
  facing: Facing;
  walked: number;
  /** Where a carried person lies from their carrier's tile, in pixels. */
  off: { x: number; y: number };
}

/** A person's lying state from the snapshot (P5.6, P5.8): down, dead or buried, and carried. */
interface Lying {
  lying: WalkerView['lying'];
  carried: boolean;
}

export class PeopleSprites {
  private people: PersonView[] = [];
  private shown = new Map<number, Shown>();
  private lying = new Map<number, Lying>();
  private z = 0;
  private live = false;

  private readonly scene: Phaser.Scene;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    // The scene has no events until the game boots; ones set before it has made its layers are
    // drawn once it has.
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.draw();
        scene.events.on(Phaser.Scenes.Events.UPDATE, (_: number, delta: number) =>
          this.glide(delta),
        );
      }),
    );
  }

  set(people: readonly PersonView[]): void {
    this.people = people.map((p) => ({ ...p }));
    this.draw();
  }

  /** Where everyone stands now (each snapshot); a change of level redraws them. */
  move(walkers: readonly WalkerView[]): void {
    let level = false;
    for (const w of walkers) {
      const p = this.people.find((q) => q.id === w.id);
      if (!p) continue;
      if (p.z !== w.z) level = true;
      [p.x, p.y, p.z] = [w.x, w.y, w.z];
      const was = this.lying.get(w.id);
      const now = { lying: w.lying, carried: !!w.carried };
      if (was && was.lying === now.lying && was.carried === now.carried) continue;
      if (!was && !now.lying) continue;
      this.lying.set(w.id, now);
      const s = this.shown.get(w.id);
      if (s) this.restyle(s);
    }
    if (level) this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  /** The person standing on a tile of the level on screen, if any. */
  at(x: number, y: number): PersonView | undefined {
    return this.people.find(
      (p) => p.x === x && p.y === y && p.z === this.z && this.lying.get(p.id)?.lying !== 'buried',
    );
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(PEOPLE)) return;
    for (const s of this.shown.values()) s.box.destroy();
    this.shown.clear();
    for (const p of this.people.filter((q) => q.z === this.z)) {
      const body = this.scene.add.image(0, 0, PEOPLE, `person.${p.race}.s.0`).setOrigin(0);
      const clothes = this.scene.add
        .image(0, 0, PEOPLE, `clothes.${p.race}.s.0`)
        .setOrigin(0)
        .setTint(colour(p.look.clothes));
      const hair = p.look.hair
        ? this.scene.add
            .image(0, 0, PEOPLE, `hair.${p.look.hair}.${p.race}.s`)
            .setOrigin(0)
            .setTint(colour(p.look.hairColour))
        : undefined;
      // Over the features and the aura glow, under the selection marks.
      const box = this.scene.add
        .container(
          p.x * TILE + LIFT_X,
          p.y * TILE + LIFT_Y,
          hair ? [body, clothes, hair] : [body, clothes],
        )
        .setScale(SIZE)
        .setDepth(8);
      const s = {
        view: p,
        box,
        body,
        clothes,
        hair,
        facing: 's' as Facing,
        walked: 0,
        off: { x: 0, y: 0 },
      };
      this.shown.set(p.id, s);
      this.restyle(s);
      box.setPosition(p.x * TILE + LIFT_X + s.off.x, p.y * TILE + LIFT_Y + s.off.y);
    }
  }

  /** Lying people (P5.6, P5.8): the stacked body, clothes and hair turn 90 degrees about the tile's
   * middle; the dead go grey, the buried are not drawn, and a carried person lies over their
   * carrier a few pixels off. A picture choice only. */
  private restyle(s: Shown): void {
    const st = this.lying.get(s.view.id);
    const lying = st?.lying;
    s.off = st?.carried ? CARRIED : { x: 0, y: 0 };
    s.box.setVisible(lying !== 'buried').setDepth(st?.carried ? 8.2 : lying ? 7.9 : 8);
    const dead = lying === 'dead' || lying === 'buried';
    const tints: [Phaser.GameObjects.Image | undefined, number | undefined][] = [
      [s.body, undefined],
      [s.clothes, colour(s.view.look.clothes)],
      [s.hair, colour(s.view.look.hairColour)],
    ];
    for (const [img, tint] of tints) {
      if (!img) continue;
      if (lying)
        img
          .setOrigin(0.5)
          .setPosition(img.width / 2, img.height / 2)
          .setAngle(90);
      else img.setOrigin(0).setPosition(0, 0).setAngle(0);
      if (dead) img.setTint(GREY);
      else if (tint === undefined) img.clearTint();
      else img.setTint(tint);
    }
  }

  /** Each frame: slide everyone towards their tile, face the way they go, step their frames. */
  private glide(delta: number): void {
    for (const s of this.shown.values()) {
      const tx = s.view.x * TILE + LIFT_X + s.off.x;
      const ty = s.view.y * TILE + LIFT_Y + s.off.y;
      const dx = tx - s.box.x;
      const dy = ty - s.box.y;
      const far = Math.hypot(dx, dy);
      if (far < 0.5) {
        if (s.walked) this.pose(s, s.facing, 0);
        s.walked = 0;
        continue;
      }
      // A jump of many tiles (a load, a long stall) is not walked out.
      const pace = Math.max((GLIDE * delta) / 1000, (far * delta) / CATCH_UP);
      const reach = far > TILE * 20 ? far : Math.min(far, pace);
      s.box.setPosition(s.box.x + (dx / far) * reach, s.box.y + (dy / far) * reach);
      const facing: Facing =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
      s.walked += delta;
      this.pose(s, facing, 1 + (Math.floor(s.walked / STRIDE) % 2));
    }
  }

  private pose(s: Shown, facing: Facing, frame: number): void {
    const { race, look } = s.view;
    s.facing = facing;
    s.body.setFrame(`person.${race}.${facing}.${frame}`);
    s.clothes.setFrame(`clothes.${race}.${facing}.${frame}`);
    s.hair?.setFrame(`hair.${look.hair}.${race}.${facing}`);
  }
}
