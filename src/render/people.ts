// The people on the map (P2.1): each a body from the `sprites-people` sheet with their clothes and
// hair laid over it, tinted to the colours drawn for them. Since P2.3 they walk: each snapshot
// moves them to the tile their row says, and on screen they walk there at the pace they really
// walked (trail.ts), facing the way they go with their two walk frames, then stand. The walk is a
// picture choice, never game state.
import Phaser from 'phaser';
import type { CoatView, PersonView, WalkerView } from '../worker/index.ts';
import type { Spot } from './finder.ts';
import { AtWork, type Dressed, type Seen } from './at-work.ts';
import { CoatTextures, watchCoatTrial } from './coats.ts';
import { bodyStem, sideFrame, variantCounts } from './look.ts';
import { PEOPLE } from './sheets.ts';
import { Trails, type TrailClock } from './trail.ts';

const TILE = 32;
// People are drawn a quarter larger than a tile (V-095): centred across it, feet on its lower
// edge, so a head may overlap the tile above.
const SIZE = 1.25;
/** Giants stand a third taller again (Morgan's look form, 2026-11-20: "everything the right
 * scale / height"); a picture choice only. */
const TALLER: Readonly<Record<string, number>> = { giant: 4 / 3 };
/** Where the sprite's corner sits from its tile's corner, for a person drawn `scale` times a
 * tile: centred across the tile with their feet on its lower edge. */
const liftOf = (scale: number) => ({ x: -(TILE * (scale - 1)) / 2, y: -TILE * (scale - 1) });
/** Milliseconds per walk frame. */
const STRIDE = 160;
/** The unburied dead are drawn grey (P5.8); a carried person lies a few pixels off their carrier. */
const GREY = 0x8a8a8a;
const CARRIED = { x: 4, y: 7 };

const colour = (hex: string): number => Number.parseInt(hex.slice(1), 16);

/** Not drawn on the map: the buried, and anyone away from the valley (P6.5). */
const hidden = (lying: string | undefined): boolean => lying === 'buried' || lying === 'away';

type Facing = 'n' | 'e' | 's' | 'w';

interface Shown extends Dressed {
  view: PersonView;
  box: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  clothes: Phaser.GameObjects.Image;
  hair: Phaser.GameObjects.Image | undefined;
  /** The body's frame-name stem (look.ts): the race's body, or one whole villager. */
  stem: string;
  /** Whole villagers wear their coat outdoors in the cold (V-190); overlay bodies never do. */
  coats: boolean;
  facing: Facing;
  frame: number;
  /** The side they last walked towards: they work facing it (V-194). */
  side: 'e' | 'w';
  walked: number;
  /** Where a carried person lies from their carrier's tile, in pixels. */
  off: { x: number; y: number };
  /** The sprite's corner from its tile's corner (liftOf). */
  lift: { x: number; y: number };
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
  /** The coat each person wears on the map now (V-190), as the worker last said. */
  private coat = new Map<number, CoatView>();
  private coats: CoatTextures | undefined;
  /** One coat everyone is drawn in, for the browser check (coats.ts `vulcan:try-coat`). */
  private tried: CoatView | undefined;
  private z = 0;
  private live = false;
  private readonly trails = new Trails();
  /** What each walker is seen doing (V-194), from the latest snapshot. */
  private readonly seen = new Map<number, Seen>();
  private work: AtWork | undefined;

  private readonly scene: Phaser.Scene;
  private readonly clock: TrailClock;

  constructor(game: Phaser.Game, scene: Phaser.Scene, clock: TrailClock) {
    this.scene = scene;
    this.clock = clock;
    // The scene has no events until the game boots; ones set before it has made its layers are
    // drawn once it has.
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.coats = new CoatTextures(scene);
        const parent = game.canvas.parentElement;
        if (parent) watchCoatTrial(game, parent, this);
        this.work = new AtWork(scene);
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
    this.trails.keep(new Set(walkers.map((w) => w.id)));
    for (const w of walkers) {
      // A change of level is a leap: they appear on the new level's tile at once.
      this.trails.note(w.id, this.clock.latest, w.x + w.z * 1000, w.y);
      this.seen.set(w.id, { act: w.act, held: w.held, load: w.load });
      const p = this.people.find((q) => q.id === w.id);
      if (!p) continue;
      if (p.z !== w.z) level = true;
      [p.x, p.y, p.z] = [w.x, w.y, w.z];
      this.dress(w);
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

  /** A coat put on, taken off or changed in look: the villager is drawn again in it. */
  private dress(w: WalkerView): void {
    const was = this.coat.get(w.id);
    if (JSON.stringify(was) === JSON.stringify(w.coat)) return;
    if (w.coat) this.coat.set(w.id, w.coat);
    else this.coat.delete(w.id);
    const s = this.shown.get(w.id);
    if (s?.coats) this.pose(s, s.facing, s.frame);
  }

  /** Draws everyone in `coat` (none: as the worker says again); returns how many are drawn in it. */
  tryCoat(coat: CoatView | undefined): number {
    this.tried = coat;
    let dressed = 0;
    for (const s of this.shown.values()) {
      if (!s.coats) continue;
      this.pose(s, s.facing, s.frame);
      const frame = s.body.frame.name;
      if (coat && (s.body.texture.key !== PEOPLE || frame.includes(`.${coat.art}.`))) dressed++;
    }
    return dressed;
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  /** The person standing on a tile of the level on screen, if any. */
  at(x: number, y: number): PersonView | undefined {
    return this.people.find(
      (p) => p.x === x && p.y === y && p.z === this.z && !hidden(this.lying.get(p.id)?.lying),
    );
  }

  /** Where a person stands now (their tile and level), for the camera to find them. */
  place(id: number): { x: number; y: number; z: number } | undefined {
    const p = this.people.find((q) => q.id === id);
    return p && !hidden(this.lying.get(id)?.lying) ? { x: p.x, y: p.y, z: p.z } : undefined;
  }

  /** Everyone drawn on the level on screen, at the middle of the tile their sprite is at now. */
  spots(): Spot[] {
    return [...this.shown.values()]
      .filter((s) => s.box.visible)
      .map((s) => ({
        id: s.view.id,
        name: s.view.name,
        x: s.box.x - s.lift.x - s.off.x + TILE / 2,
        y: s.box.y - s.lift.y - s.off.y + TILE / 2,
      }));
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(PEOPLE)) return;
    for (const s of this.shown.values()) s.box.destroy();
    this.shown.clear();
    const counts = variantCounts(this.scene.textures.get(PEOPLE).getFrameNames());
    for (const p of this.people.filter((q) => q.z === this.z)) {
      const { stem, overlays } = bodyStem(counts, p.race, p.id);
      const body = this.scene.add.image(0, 0, PEOPLE, `${stem}.s.0`).setOrigin(0);
      const clothes = this.scene.add
        .image(0, 0, PEOPLE, `clothes.${p.race}.s.0`)
        .setOrigin(0)
        .setTint(colour(p.look.clothes))
        .setVisible(overlays);
      const hair =
        overlays && p.look.hair
          ? this.scene.add
              .image(0, 0, PEOPLE, `hair.${p.look.hair}.${p.race}.s`)
              .setOrigin(0)
              .setTint(colour(p.look.hairColour))
          : undefined;
      // Over the features and the aura glow, under the selection marks.
      const scale = SIZE * (TALLER[p.race] ?? 1);
      const lift = liftOf(scale);
      const box = this.scene.add
        .container(0, 0, hair ? [body, clothes, hair] : [body, clothes])
        .setScale(scale)
        .setDepth(8);
      const s: Shown = {
        id: p.id,
        images: hair ? [body, clothes, hair] : [body, clothes],
        view: p,
        box,
        body,
        clothes,
        hair,
        stem,
        coats: !overlays,
        facing: 's' as Facing,
        frame: 0,
        side: p.id % 2 ? 'w' : 'e',
        walked: 0,
        off: { x: 0, y: 0 },
        lift,
      };
      this.shown.set(p.id, s);
      if (s.coats) this.pose(s, 's', 0);
      this.restyle(s);
      box.setPosition(p.x * TILE + lift.x + s.off.x, p.y * TILE + lift.y + s.off.y);
    }
  }

  /** Lying people (P5.6, P5.8): the stacked body, clothes and hair turn 90 degrees about the tile's
   * middle; the dead go grey, the buried and those away are not drawn, and a carried person lies over their
   * carrier a few pixels off. A picture choice only. */
  private restyle(s: Shown): void {
    const st = this.lying.get(s.view.id);
    const lying = st?.lying;
    s.off = st?.carried ? CARRIED : { x: 0, y: 0 };
    if (lying) this.work?.clear(s);
    s.box.setVisible(!hidden(lying)).setDepth(st?.carried ? 8.2 : lying ? 7.9 : 8);
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

  /** Each frame: draw everyone where the screen's clock finds them on their trail, facing the way
   * they go and stepping their frames while they move. */
  private glide(delta: number): void {
    const now = this.clock.at(this.scene.game.loop.time);
    this.work?.tick(delta / 1000, this.clock.paused);
    for (const s of this.shown.values()) {
      const d = this.trails.at(s.view.id, now);
      const [x, y] = d ? [d.x - s.view.z * 1000, d.y] : [s.view.x, s.view.y];
      s.box.setPosition(x * TILE + s.lift.x + s.off.x, y * TILE + s.lift.y + s.off.y);
      if (this.lying.get(s.view.id)?.lying) continue;
      const seen = this.seen.get(s.view.id);
      if (!d?.moving) {
        // At work they face the side they came from, so the stroke lands on the work (V-194).
        const facing = seen?.act ? s.side : s.facing;
        if (s.walked || facing !== s.facing) this.pose(s, facing, 0);
        s.walked = 0;
        this.work?.draw(s, seen, { facing, bob: 0 });
        continue;
      }
      const facing: Facing =
        Math.abs(d.dx) > Math.abs(d.dy) ? (d.dx > 0 ? 'e' : 'w') : d.dy > 0 ? 's' : 'n';
      if (d.dx) s.side = d.dx > 0 ? 'e' : 'w';
      s.walked += delta;
      const frame = 1 + (Math.floor(s.walked / STRIDE) % 2);
      this.pose(s, facing, frame);
      // The screen runs behind the world: no stroke is drawn until they have walked there.
      const walking = seen && { held: seen.held, load: seen.load };
      this.work?.draw(s, walking, { facing, bob: frame === 2 ? 1 : 0 });
    }
  }

  /** The first person on the level on screen standing at work with `motion` (any motion when
   * none is named; `load` finds someone carrying one), for the browser check. */
  working(motion?: string): Spot | undefined {
    const hit = [...this.shown.values()].find((s) => {
      if (motion === 'load') return s.box.visible && !!s.load?.visible;
      const act = this.seen.get(s.id)?.act;
      return s.box.visible && !!act && (!motion || act.motion === motion);
    });
    return hit && this.spots().find((p) => p.id === hit.id);
  }

  /** How many people on the level on screen carry a load or hold a tool (the browser check). */
  get carrying(): { loads: number; tools: number } {
    const shown = [...this.shown.values()].filter((s) => s.box.visible);
    return {
      loads: shown.filter((s) => s.load?.visible).length,
      tools: shown.filter((s) => s.hand?.visible).length,
    };
  }

  /** How many work bits are in the air (the browser check reads it). */
  get bits(): number {
    return this.work?.bits ?? 0;
  }

  private pose(s: Shown, facing: Facing, frame: number): void {
    const { race, look } = s.view;
    s.facing = facing;
    s.frame = frame;
    const side = sideFrame(s.stem, facing);
    const coat = s.coats ? (this.tried ?? this.coat.get(s.view.id)) : undefined;
    const body = this.coats?.body(s.stem, coat, side.facing, frame);
    if (!body) s.body.setFrame(`${s.stem}.${side.facing}.${frame}`);
    else if (body.key !== s.body.texture.key) s.body.setTexture(body.key, body.frame);
    else if (body.frame) s.body.setFrame(body.frame);
    s.body.setFlipX(side.flip);
    s.clothes.setFrame(`clothes.${race}.${facing}.${frame}`);
    s.hair?.setFrame(`hair.${look.hair}.${race}.${facing}`);
  }
}
