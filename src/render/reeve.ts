// The lord's reeve on the map (6C Slice 4, V-237) while he is in the valley: the cloaked figure of
// the lord's people from the people sheet (`person.<race>.v1.cloak`) with the `cart` from the items
// sheet one tile behind him; no new art. He walks the trail his rows give, like a person (trail.ts),
// facing the way he goes. While the lord rides with him (6C Slice 7) the lord walks at his side in
// the same people art, tinted gold. A picture only: where he is and why is the engine's (GAME-02).
import Phaser from 'phaser';
import type { ReeveView } from '../worker/index.ts';
import { liftOf, scaleOf } from './people.ts';
import { ITEMS, PEOPLE } from './sheets.ts';
import { sideFrame } from './look.ts';
import { Trails, type TrailClock } from './trail.ts';

const TILE = 32;
const ID = 1;
/** Milliseconds per walk frame, as the people's (people.ts). */
const STRIDE = 160;
const STEP = 140;
type Facing = 'n' | 'e' | 's' | 'w';
/** Where the cart stands from him: one tile behind, against the way he faces. */
const BEHIND: Readonly<Record<Facing, { x: number; y: number }>> = {
  e: { x: -1, y: 0 },
  w: { x: 1, y: 0 },
  n: { x: 0, y: 1 },
  s: { x: 0, y: -1 },
};
/** Where the lord walks from him: one tile to his right hand. */
const BESIDE: Readonly<Record<Facing, { x: number; y: number }>> = {
  e: { x: 0, y: 1 },
  w: { x: 0, y: -1 },
  n: { x: 1, y: 0 },
  s: { x: -1, y: 0 },
};
/** The lord's gold, over the cloak. */
const GOLD = 0xffd27a;

export class ReeveSprite {
  private view: ReeveView | undefined;
  private body: Phaser.GameObjects.Image | undefined;
  private cart: Phaser.GameObjects.Image | undefined;
  private lord: Phaser.GameObjects.Image | undefined;
  private pos = { x: 0, y: 0 };
  private facing: Facing = 's';
  private walked = 0;
  private z = 0;
  private live = false;
  private readonly trails = new Trails();
  private readonly scene: Phaser.Scene;
  private readonly clock: TrailClock;

  constructor(game: Phaser.Game, scene: Phaser.Scene, clock: TrailClock) {
    this.scene = scene;
    this.clock = clock;
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

  /** The reeve as the snapshot has him; none once he has gone. */
  set(view: ReeveView | undefined): void {
    const was = this.view?.race;
    const had = this.view?.lord;
    this.view = view;
    if (view) {
      this.trails.note(ID, this.clock.latest, view.x, view.y);
      if (was === undefined) this.pos = { x: view.x, y: view.y };
    } else this.trails.keep(new Set());
    if (was !== view?.race || had !== view?.lord) this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.glide(0);
  }

  /** Whether he (or his cart) stands on a tile of the level on screen. */
  at(x: number, y: number): boolean {
    if (!this.view || !this.body?.visible) return false;
    const [tx, ty] = [Math.round(this.pos.x), Math.round(this.pos.y)];
    const b = BEHIND[this.facing];
    const s = BESIDE[this.facing];
    const lord = !!this.lord && tx + s.x === x && ty + s.y === y;
    return (tx === x && ty === y) || (tx + b.x === x && ty + b.y === y) || lord;
  }

  /** The middle of his tile in map px, for the browser check to tap; none when not drawn. */
  spot(): { x: number; y: number } | undefined {
    if (!this.body?.visible) return undefined;
    return { x: (Math.round(this.pos.x) + 0.5) * TILE, y: (Math.round(this.pos.y) + 0.5) * TILE };
  }

  private draw(): void {
    this.body?.destroy();
    this.cart?.destroy();
    this.lord?.destroy();
    [this.body, this.cart, this.lord] = [undefined, undefined, undefined];
    const view = this.view;
    if (!this.live || !view || !this.scene.textures.exists(PEOPLE)) return;
    const stem = `person.${view.race}.v1.cloak`;
    if (!this.scene.textures.get(PEOPLE).has(`${stem}.s.0`)) return;
    this.body = this.scene.add
      .image(0, 0, PEOPLE, `${stem}.s.0`)
      .setOrigin(0)
      .setScale(scaleOf(view.race))
      .setDepth(8);
    if (this.scene.textures.exists(ITEMS))
      this.cart = this.scene.add.image(0, 0, ITEMS, 'cart').setOrigin(0).setDepth(7.9);
    if (view.lord)
      this.lord = this.scene.add
        .image(0, 0, PEOPLE, `${stem}.s.0`)
        .setOrigin(0)
        .setScale(scaleOf(view.race))
        .setTint(GOLD)
        .setDepth(8);
    this.glide(0);
  }

  /** The cloak's walk frames after its standing frame in a facing (2 drawn, up to 7). */
  private steps(stem: string, facing: string): number {
    const tex = this.scene.textures.get(PEOPLE);
    let n = 1;
    while (tex.has(`${stem}.${facing}.${n + 1}`)) n++;
    return n;
  }

  /** Each frame: draw him where the screen's clock finds him on his trail, facing his way. */
  private glide(delta: number): void {
    const { view, body, cart } = this;
    if (!view || !body) return;
    const d = this.trails.at(ID, this.clock.at(this.scene.game.loop.time));
    const [x, y] = d ? [d.x, d.y] : [view.x, view.y];
    this.pos = { x, y };
    if (d?.moving)
      this.facing = Math.abs(d.dx) > Math.abs(d.dy) ? (d.dx > 0 ? 'e' : 'w') : d.dy > 0 ? 's' : 'n';
    const stem = `person.${view.race}.v1.cloak`;
    const side = sideFrame(`person.${view.race}.v1`, this.facing);
    let frame = 0;
    if (d?.moving) {
      const steps = this.steps(stem, side.facing);
      this.walked += delta;
      frame = 1 + (Math.floor(this.walked / (steps > 2 ? STEP : STRIDE)) % steps);
    } else this.walked = 0;
    const name = `${stem}.${side.facing}.${frame}`;
    if (body.frame.name !== name && this.scene.textures.get(PEOPLE).has(name)) body.setFrame(name);
    body.setFlipX(side.flip);
    const lift = liftOf(scaleOf(view.race));
    const shown = this.z === view.z;
    body.setPosition(x * TILE + lift.x, y * TILE + lift.y).setVisible(shown);
    const b = BEHIND[this.facing];
    cart?.setPosition((x + b.x) * TILE, (y + b.y) * TILE).setVisible(shown);
    const s = BESIDE[this.facing];
    if (this.lord && this.lord.frame.name !== body.frame.name) this.lord.setFrame(body.frame.name);
    this.lord
      ?.setFlipX(side.flip)
      .setPosition((x + s.x) * TILE + lift.x, (y + s.y) * TILE + lift.y)
      .setVisible(shown);
  }
}
