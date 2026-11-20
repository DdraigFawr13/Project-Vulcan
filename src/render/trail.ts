// Smooth walking (Morgan 2026-11-20: "everything moves in a really jerky fashion"). People walk a
// tile every two game minutes, so at 1x a tile arrives every 0.2 s; gliding at a fixed speed
// reached it in half that and stood still for the rest, stepping and stopping five times a
// second. Now the screen runs a few game minutes behind the world, on its own smooth clock, and
// draws each walker between the tiles it has already seen them reach, at the pace they really
// walked. A picture choice only, never game state.

/** Game minutes the screen runs behind the world: enough to have seen the next tile (a diagonal
 * step takes 2.8) before it is walked, about a third of a second at 1x and 30 ms at 3x. */
export const LAG = 3;
/** Never further behind than this; a tab that stalled jumps forward rather than replaying. */
const MAX_LAG = 12;
/** Game minutes a step that follows a stand is drawn over, per tile: a little slower than a
 * stride, so nobody darts off. Steps in a row take the time they really took. */
const STEP = 3;
/** A move of more tiles than this (a load, a level change, a long skip) is not walked out. */
const LEAP = 20;
/** Samples kept per walker; older ones are behind the clock. */
const KEEP = 8;

/** The screen's own clock, in game minutes: it runs at the game's speed and eases towards `LAG`
 * minutes behind the newest snapshot, so each frame moves everyone by an even amount. */
export class TrailClock {
  /** The newest snapshot's tick. */
  latest = 0;
  private now = 0;
  private rate = 0;
  private skipping = false;
  private frame = -1;

  /** A snapshot arrived: its tick, the game minutes a real second, and whether it skips ahead. */
  seen(tick: number, perSecond: number, skipping: boolean): void {
    if (tick < this.latest || this.frame < 0) this.now = tick;
    this.latest = tick;
    this.rate = perSecond;
    this.skipping = skipping;
  }

  /** The clock at real time `time` (ms); every layer asks once a frame and gets the same answer. */
  at(time: number): number {
    const delta = this.frame < 0 ? 0 : Math.min(250, time - this.frame);
    this.frame = time;
    if (this.skipping) return (this.now = this.latest);
    // Paused, the screen catches up with the world at the 1x pace and stops on it.
    const rate = this.rate || 10;
    const behind = this.latest - this.now;
    const ease = Math.min(1.5, Math.max(0.5, 1 + (behind - LAG) / (2 * LAG)));
    this.now += (delta * rate * ease) / 1000;
    const ahead = this.rate ? this.latest - LAG / 3 : this.latest;
    this.now = Math.min(ahead, Math.max(this.latest - MAX_LAG, this.now));
    return this.now;
  }
}

interface Sample {
  tick: number;
  x: number;
  y: number;
}

/** Where a walker is drawn: a point between tiles, and the way they go while they move. */
export interface Drawn {
  x: number;
  y: number;
  moving: boolean;
  dx: number;
  dy: number;
}

/** Each walker's last tiles and the ticks they reached them, read back at the screen's clock. */
export class Trails {
  private readonly by = new Map<number, Sample[]>();

  /** Walker `id` stands on tile (x, y) at `tick`; only a change of tile is kept. */
  note(id: number, tick: number, x: number, y: number): void {
    const list = this.by.get(id);
    const last = list?.at(-1);
    if (!list || !last) return void this.by.set(id, [{ tick, x, y }]);
    if (last.x === x && last.y === y) return;
    if (Math.hypot(x - last.x, y - last.y) > LEAP) list.length = 0;
    list.push({ tick, x, y });
    if (list.length > KEEP) list.splice(0, list.length - KEEP);
  }

  /** Walkers not in `ids` are forgotten. */
  keep(ids: ReadonlySet<number>): void {
    for (const id of this.by.keys()) if (!ids.has(id)) this.by.delete(id);
  }

  /** Where walker `id` is drawn at clock `now`, or undefined if they were never seen. */
  at(id: number, now: number): Drawn | undefined {
    const list = this.by.get(id);
    if (!list?.length) return undefined;
    for (let i = list.length - 1; i > 0; i -= 1) {
      const [from, to] = [list[i - 1]!, list[i]!];
      if (now >= to.tick) return still(to);
      const far = Math.hypot(to.x - from.x, to.y - from.y);
      const start = Math.max(from.tick, to.tick - STEP * far);
      if (now < start) continue;
      const t = (now - start) / Math.max(0.001, to.tick - start);
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        moving: true,
        dx: to.x - from.x,
        dy: to.y - from.y,
      };
    }
    // Before every step still kept: where they were first seen.
    return still(list[0]!);
  }
}

const still = (s: Sample): Drawn => ({ x: s.x, y: s.y, moving: false, dx: 0, dy: 0 });
