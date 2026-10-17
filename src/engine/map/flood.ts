// Priority flood: fills every hollow of a height field to its brim from the map's edges, so water
// has somewhere to go from every tile. Plain arithmetic only (V-006).

/** The eight neighbours, edges first. */
export const N8: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** A min-heap of tile indices by key; equal keys leave in the order they came. */
class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  private order: number[] = [];
  private pushed = 0;

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    this.order.push(this.pushed);
    this.pushed += 1;
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    this.swap(0, this.items.length - 1);
    this.items.pop();
    this.keys.pop();
    this.order.pop();
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      let least = i;
      if (left < this.items.length && this.less(left, least)) least = left;
      if (left + 1 < this.items.length && this.less(left + 1, least)) least = left + 1;
      if (least === i) return top;
      this.swap(i, least);
      i = least;
    }
  }

  private less(a: number, b: number): boolean {
    const ka = this.keys[a]!;
    const kb = this.keys[b]!;
    return ka < kb || (ka === kb && this.order[a]! < this.order[b]!);
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
    [this.order[a], this.order[b]] = [this.order[b]!, this.order[a]!];
  }
}

export interface Flooded {
  /** The height each tile's water stands at: its own, or a hollow's brim plus a hair per step. */
  level: number[];
  /** Tiles from lowest level to highest; water runs from later tiles to earlier ones. */
  order: number[];
}

/** Floods `surface` from the map's edge tiles inwards, lowest first. */
export function flood(surface: readonly number[], width: number, height: number): Flooded {
  const n = width * height;
  const level = new Array<number>(n).fill(0);
  const done = new Uint8Array(n);
  const order: number[] = [];
  const heap = new Heap();
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        const i = y * width + x;
        done[i] = 1;
        level[i] = surface[i]!;
        heap.push(i, level[i]!);
      }
  while (heap.size > 0) {
    const i = heap.pop();
    order.push(i);
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (done[j]) continue;
      done[j] = 1;
      level[j] = Math.max(surface[j]!, level[i]! + 0.001);
      heap.push(j, level[j]!);
    }
  }
  return { level, order };
}
