// The page's copy of the clock's speed (V-191). The worker changes speed by itself (a jump ends,
// a Pause line stops play, a Slow line drops it to 1×), so each snapshot's speed is taken unless
// the player chose one after that snapshot was asked for: messages to the worker run in order.
import type { Speed, ToWorker } from '../worker/index.ts';

export class SpeedState {
  speed: Speed = 0;
  /** The speed Space resumes to. */
  lastRunning: Exclude<Speed, 0> = 1;
  /** Jumping ahead, as of the last snapshot. */
  skipping = false;
  private asked = 0;
  private askedAt = 0;
  private readonly send: (m: ToWorker) => void;
  /** Whether a speed may be sent now (a world is ready and no save is loading). */
  private readonly can: () => boolean;

  constructor(send: (m: ToWorker) => void, can: () => boolean) {
    this.send = send;
    this.can = can;
  }

  set = (next: Speed): void => {
    // Until a world is ready, or while a save loads, the worker resets the speed itself.
    if (!this.can()) return;
    this.speed = next;
    if (next !== 0) this.lastRunning = next;
    this.asked += 1;
    this.send({ type: 'setSpeed', speed: next });
  };

  /** Space: pause, or resume at the last running speed. */
  toggle = (): void => this.set(this.speed === 0 ? this.lastRunning : 0);

  /** A snapshot was just asked for. */
  requested(): void {
    this.askedAt = this.asked;
  }

  /** A world began or loaded: it starts paused. */
  reset(): void {
    this.speed = 0;
  }

  snapshot(m: { speed: Speed; skipping: boolean }): void {
    this.skipping = m.skipping;
    if (this.askedAt !== this.asked) return; // the player chose since: the worker will follow
    this.speed = m.speed;
    if (m.speed !== 0) this.lastRunning = m.speed;
  }
}
