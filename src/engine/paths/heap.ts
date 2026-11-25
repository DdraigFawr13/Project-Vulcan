// A binary min-heap of whole-number keys for the path searches. A search packs each entry as
// `cost * span + node` (`span` above every node), so one number orders by cost, then node number,
// exactly as comparing the two in turn would, and pops always come in that one order.

export class KeyHeap {
  private keys = new Float64Array(1024);
  size = 0;

  clear(): void {
    this.size = 0;
  }

  push(key: number): void {
    if (this.size === this.keys.length) {
      const bigger = new Float64Array(this.keys.length * 2);
      bigger.set(this.keys);
      this.keys = bigger;
    }
    const keys = this.keys;
    let c = this.size;
    this.size += 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (keys[p]! <= key) break;
      keys[c] = keys[p]!;
      c = p;
    }
    keys[c] = key;
  }

  /** The least key, taken off the heap; call only while `size` is above 0. */
  pop(): number {
    const keys = this.keys;
    const top = keys[0]!;
    this.size -= 1;
    const size = this.size;
    if (!size) return top;
    const last = keys[size]!;
    let c = 0;
    for (;;) {
      let m = 2 * c + 1;
      if (m >= size) break;
      if (m + 1 < size && keys[m + 1]! < keys[m]!) m += 1;
      if (keys[m]! >= last) break;
      keys[c] = keys[m]!;
      c = m;
    }
    keys[c] = last;
    return top;
  }
}
