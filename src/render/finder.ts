// Finding people (Morgan, 2026-10-25): a view aid, never an order (V-015). The person whose sheet
// is open wears an ember ring that walks with them, with a pulse as it goes on; Names rings
// everyone on the level on screen in ember too and writes their first name over their head. Both
// follow the drawn sprites, so they glide with them. View state only.
import Phaser from 'phaser';

const TILE = 32;
/** Over the people (8) and the night (8.6), so a ring reads after dark too. */
const RING_DEPTH = 8.7;
const PULSE_DEPTH = 8.7;
const NAME_DEPTH = 9.6;
/** The pulse: two waves widening from the feet, over this many ms. */
const PULSE_MS = 2400;
const WAVES = 2;
/** Names stay this many screen px tall at any zoom. */
const NAME_PX = 14;

/** A person drawn on the level on screen: the middle of their tile, in map px. */
export interface Spot {
  id: number;
  name: string;
  x: number;
  y: number;
}

const token = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const colour = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

export class Finder {
  private followed: number | undefined;
  /** ms since the ring went on: the pulse runs while under PULSE_MS. */
  private age = PULSE_MS;
  private all = false;
  private rings: Phaser.GameObjects.Graphics | undefined;
  private pulse: Phaser.GameObjects.Graphics | undefined;
  private readonly names = new Map<number, Phaser.GameObjects.Text>();
  private readonly scene: Phaser.Scene;
  private readonly spots: () => Spot[];

  constructor(game: Phaser.Game, scene: Phaser.Scene, spots: () => Spot[]) {
    this.scene = scene;
    this.spots = spots;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.rings = scene.add.graphics().setDepth(RING_DEPTH);
        this.pulse = scene.add.graphics().setDepth(PULSE_DEPTH);
        scene.events.on(Phaser.Scenes.Events.UPDATE, (_: number, delta: number) =>
          this.frame(delta),
        );
      }),
    );
  }

  /** Rings this person (their sheet is open) and pulses once; undefined takes the ring off. */
  follow(id: number | undefined, pulse = true): void {
    if (id !== this.followed || pulse) this.age = pulse && id !== undefined ? 0 : PULSE_MS;
    this.followed = id;
  }

  /** Rings and names everyone on the level on screen, or stops. */
  showNames(on: boolean): void {
    this.all = on;
  }

  private frame(delta: number): void {
    const rings = this.rings;
    const pulse = this.pulse;
    if (!rings || !pulse) return;
    rings.clear();
    pulse.clear();
    this.age = Math.min(PULSE_MS, this.age + delta);
    const zoom = this.scene.cameras.main.zoom;
    const ember = colour(token('--ember', '#c8743a'));
    const dark = colour(token('--oak-dark', '#1a110b'));
    const named = new Set<number>();
    for (const s of this.spots()) {
      const mine = s.id === this.followed;
      if (!mine && !this.all) continue;
      // A ring round the whole person, like the ember ring round a chosen face on the strip: an
      // ember band between two dark edges, so it reads on grass, snow and stone alike.
      const [cx, cy, r] = [s.x, s.y - TILE * 0.15, TILE * 0.8];
      rings.lineStyle(7, dark, 0.85).strokeCircle(cx, cy, r);
      rings.lineStyle(3, ember, 1).strokeCircle(cx, cy, r);
      if (mine && this.age < PULSE_MS)
        for (let w = 0; w < WAVES; w += 1) {
          const t = (this.age / PULSE_MS) * WAVES - w;
          if (t < 0 || t > 1) continue;
          const wave = TILE * (0.8 + 2.2 * t);
          pulse.lineStyle(Math.max(3, 4 / zoom), ember, 1 - t).strokeCircle(cx, cy, wave);
        }
      if (this.all) {
        named.add(s.id);
        this.nameOf(s)
          .setPosition(s.x, s.y - TILE * 1.0)
          .setScale(1 / zoom);
      }
    }
    for (const [id, text] of this.names)
      if (!named.has(id)) {
        text.destroy();
        this.names.delete(id);
      }
  }

  /** A first name in the page's reading face, bone with a dark edge, like the map's other labels. */
  private nameOf(s: Spot): Phaser.GameObjects.Text {
    let text = this.names.get(s.id);
    if (!text) {
      text = this.scene.add
        .text(0, 0, s.name.split(' ')[0]!, {
          fontFamily: token('--read', 'Georgia, serif'),
          fontSize: `${NAME_PX}px`,
          fontStyle: 'bold',
          color: token('--bone', '#efe2c2'),
          stroke: token('--oak-dark', '#1a110b'),
          strokeThickness: 4,
          resolution: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(NAME_DEPTH);
      this.names.set(s.id, text);
    }
    return text;
  }
}
