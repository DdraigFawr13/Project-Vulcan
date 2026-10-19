// The test tools' orders (dig, mark a tree, add a store tile, plan a part or take one down) and a
// house's Send back: each is stamped for the next tick and the tile is asked for again once it is
// answered, so the sheet shows the result. A dig order is followed until its answer (at once while
// paused), and a refusal is kept to show once.
import type { LedgerLine, TileView, ToWorker } from '../worker/index.ts';

/** The ledger lines that answer a dig order. At 3x an order can land a tick or two late. */
const ANSWERS = ['map.stairsCut', 'map.shaftSunk', 'map.digRefused'];

interface Order {
  x: number;
  y: number;
  z: number;
  tick: number;
  dig: boolean;
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

  /** Sends order `kind` on `tile` for tick `tick`, and asks for the tile now and again once it
   * is answered. */
  give(tile: TileView, kind: string, tick: number, arg?: number | string): void {
    const { x, y, z } = tile;
    const dig = kind === 'cutStairs' || kind === 'sinkShaft';
    this.order = { x, y, z, tick, dig };
    const data = dig
      ? { x, y, z, ...(arg !== undefined && { to: arg }) }
      : kind === 'sendBack'
        ? { house: arg as number }
        : { x, y, ...(kind === 'placeBuilding' && arg !== undefined && { part: arg }) };
    this.send({ type: 'command', tick, kind, data });
    this.send({ type: 'inspect', x, y, z });
  }

  /** New ledger lines: an order's answer (a dig's own line, or any other order's applying) comes
   * just before the snapshot that asks again, at once while paused. */
  lines(batch: readonly LedgerLine[]): void {
    const order = this.order;
    for (const line of batch)
      if (
        order &&
        !order.answered &&
        (order.dig ? ANSWERS.includes(line.type) : line.type === 'command.applied') &&
        line.tick >= order.tick
      ) {
        order.answered = true;
        if (line.type === 'map.digRefused') order.refused = line;
      } else if (
        order?.answered &&
        !order.dig &&
        line.type === 'command.refused' &&
        line.tick >= order.tick
      )
        // Any other order's refusal comes just after it is applied.
        order.refused = line;
  }

  /** The snapshot after an order's answer asks once for the tile again, if it is shown. */
  snapshot(shown: TileView | undefined): void {
    const order = this.order;
    if (!order?.answered || order.asked) return;
    order.asked = true;
    const { x, y, z } = order;
    if (shown?.x === x && shown.y === y && shown.z === z) this.send({ type: 'inspect', x, y, z });
  }

  /** What became of the last order on `tile`, once: the line refusing it, once answered. */
  noticeFor(tile: TileView): LedgerLine | undefined {
    const order = this.order;
    if (!order || order.x !== tile.x || order.y !== tile.y || order.z !== tile.z) return undefined;
    if (!order.answered) return undefined;
    const { refused } = order;
    if (order.asked) this.order = undefined;
    return refused;
  }
}
