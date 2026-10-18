// The test tools' orders (dig, mark a tree, add a store tile): each is stamped for the next tick
// and the tile is asked for again once it is answered, so the sheet shows the result. A dig order
// is followed until its answer: while paused the sheet says it waits, and a refusal is kept to
// show once.
import type { LedgerLine, Speed, TileView, ToWorker } from '../worker/index.ts';

/** The ledger lines that answer a dig order. At 3x an order can land a tick or two late. */
const ANSWERS = ['map.stairsCut', 'map.shaftSunk', 'map.digRefused'];
const PAUSED_NOTE = 'Paused: this is dug on the next game minute once time runs (1×, 2× or 3×).';

interface Order {
  x: number;
  y: number;
  z: number;
  tick: number;
  answered?: boolean;
  refused?: LedgerLine;
  asked?: boolean;
}

export class Orders {
  private order: Order | undefined;
  private readonly send: (message: ToWorker) => void;

  constructor(send: (message: ToWorker) => void) {
    this.send = send;
  }

  clear(): void {
    this.order = undefined;
  }

  /** Sends order `kind` on `tile` for tick `tick`, and asks for the tile now (a paused game says
   * a dig waits) and again once it is answered. */
  give(tile: TileView, kind: string, tick: number, to?: number): void {
    const { x, y, z } = tile;
    const dig = kind === 'cutStairs' || kind === 'sinkShaft';
    this.order = { x, y, z, tick, ...(!dig && { answered: true }) };
    const data = dig ? { x, y, z, ...(to !== undefined && { to }) } : { x, y };
    this.send({ type: 'command', tick, kind, data });
    this.send({ type: 'inspect', x, y, z });
  }

  /** New ledger lines: a dig's answer comes just before the snapshot that asks again. */
  lines(batch: readonly LedgerLine[]): void {
    const order = this.order;
    for (const line of batch)
      if (order && !order.answered && ANSWERS.includes(line.type) && line.tick >= order.tick) {
        order.answered = true;
        if (line.type === 'map.digRefused') order.refused = line;
      }
  }

  /** Each snapshot past an answered order's tick asks once for the tile again, if it is shown. */
  snapshot(tick: number, shown: TileView | undefined): void {
    const order = this.order;
    if (!order?.answered || order.asked || tick <= order.tick) return;
    order.asked = true;
    const { x, y, z } = order;
    if (shown?.x === x && shown.y === y && shown.z === z) this.send({ type: 'inspect', x, y, z });
  }

  /** What became of the last dig order on `tile`, once: it waits while paused, or the line
   * refusing it once answered. */
  noticeFor(tile: TileView, speed: Speed): string | LedgerLine | undefined {
    const order = this.order;
    if (!order || order.x !== tile.x || order.y !== tile.y || order.z !== tile.z) return undefined;
    if (!order.answered) return speed === 0 ? PAUSED_NOTE : undefined;
    const { refused } = order;
    if (order.asked) this.order = undefined;
    return refused;
  }
}
