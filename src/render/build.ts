// Built parts and plans on the map (P3.1, P3.2), from the `buildings` sheet: floors under
// everything, then walls and doors, with plans drawn faint over the ground as what they will
// be. Slim walls are a band through the middle of their tile (the taste board's pick): a wall
// joins the walls and doors beside it, and on a side (or inner corner) that meets a floor the
// floor's half (or quarter) shows under it, so a wall reads over every floor and ground. A part to come down shows tinted.
// Pictures only: what is built comes from the chunks' `built` and the snapshot's plans.
import Phaser from 'phaser';
import { content } from '../content/index.ts';
import type { ChunkView, GoodsView } from '../worker/index.ts';
import { BUILDINGS } from './sheets.ts';

const TILE = 32;
const PLAN_ALPHA = 0.5;
const DOWN_TINT = 0xd08060;
const SIDES = [
  ['n', 0, -1, 1],
  ['e', 1, 0, 2],
  ['s', 0, 1, 4],
  ['w', -1, 0, 8],
] as const;
const CORNERS = [
  ['ne', 1, -1],
  ['se', 1, 1],
  ['sw', -1, 1],
  ['nw', -1, -1],
] as const;

type Part = (typeof content.buildings.parts)[number];
interface Shown {
  part: Part;
  plan: boolean;
  down: boolean;
}

export class BuildSprites {
  private built = new Uint8Array(0);
  private width = 0;
  private plans: GoodsView['plans'] = [];
  private shown: Phaser.GameObjects.Image[] = [];
  private key = '';
  private z = 0;
  private live = false;
  private version = 0;

  private readonly scene: Phaser.Scene;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.draw();
      }),
    );
  }

  setMapSize(width: number, height: number): void {
    this.width = width;
    this.built = new Uint8Array(width * height);
    this.version += 1;
  }

  /** Copies the surface chunks' built parts; redraws if any changed. */
  applyChunks(chunks: readonly ChunkView[]): void {
    let changed = false;
    for (const c of chunks) {
      if (c.z !== 0 || !c.built) continue;
      for (let dy = 0; dy < c.h; dy += 1)
        for (let dx = 0; dx < c.w; dx += 1) {
          const i = (c.y + dy) * this.width + c.x + dx;
          const b = c.built[dy * c.w + dx]!;
          if (this.built[i] !== b) [this.built[i], changed] = [b, true];
        }
    }
    if (changed) {
      this.version += 1;
      this.draw();
    }
  }

  setPlans(plans: GoodsView['plans']): void {
    this.plans = plans;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  /** What shows on each surface tile: the built part, or a plan over bare ground. */
  private tiles(): Map<number, Shown> {
    const parts = content.buildings.parts;
    const out = new Map<number, Shown>();
    this.built.forEach((b, i) => {
      if (b) out.set(i, { part: parts[b - 1]!, plan: false, down: false });
    });
    for (const p of this.plans) {
      if (p.z !== 0) continue;
      const i = p.y * this.width + p.x;
      const part = parts.find((d) => d.id === p.part);
      const there = out.get(i);
      if (there) there.down = p.state === 'down';
      else if (part) out.set(i, { part, plan: true, down: p.state === 'down' });
    }
    return out;
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(BUILDINGS)) return;
    const key = `${this.z}:${this.version}:${JSON.stringify(this.plans)}`;
    if (key === this.key) return;
    this.key = key;
    for (const s of this.shown) s.destroy();
    this.shown = [];
    if (this.z !== 0) return;
    const tiles = this.tiles();
    const at = (x: number, y: number) =>
      x < 0 || x >= this.width ? undefined : tiles.get(y * this.width + x);
    const joins = (s: Shown | undefined) => s?.part.kind === 'wall' || s?.part.kind === 'door';
    for (const [i, s] of tiles) {
      const [x, y] = [i % this.width, Math.floor(i / this.width)];
      const { kind } = s.part;
      if (kind === 'floor' || kind === 'stair') {
        this.put(x, y, s.part.art, s, 4);
        continue;
      }
      // A wall or door: the floor beside it shows on its side, then the band.
      for (const [side, dx, dy] of SIDES) {
        const n = at(x + dx, y + dy);
        if (n?.part.kind === 'floor') this.put(x, y, `${n.part.art}.half.${side}`, n, 4);
      }
      for (const [corner, dx, dy] of CORNERS) {
        const n = at(x + dx, y + dy);
        if (n?.part.kind === 'floor') this.put(x, y, `${n.part.art}.q.${corner}`, n, 4);
      }
      const mask = SIDES.reduce(
        (m, [, dx, dy, bit]) => (joins(at(x + dx, y + dy)) ? m | bit : m),
        0,
      );
      const frame =
        kind === 'wall'
          ? `${s.part.art}.${mask}`
          : `${s.part.art}.${mask & 5 && !(mask & 10) ? 'v' : 'h'}`;
      this.put(x, y, frame, s, 7);
    }
  }

  private put(x: number, y: number, frame: string, s: Shown, depth: number): void {
    if (!this.scene.textures.get(BUILDINGS).has(frame)) return;
    const image = this.scene.add
      .image(x * TILE, y * TILE, BUILDINGS, frame)
      .setOrigin(0)
      .setDepth(depth);
    if (s.plan) image.setAlpha(PLAN_ALPHA);
    if (s.down) image.setTint(DOWN_TINT);
    this.shown.push(image);
  }
}
