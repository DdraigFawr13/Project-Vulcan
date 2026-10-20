// Progress bars for timed jobs beyond building, and the metal line under an ingot plate.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, step, submitCommand } from '../engine/index.ts';
import { goodsOf, stockView } from './goods.ts';
import { metalStatus } from './metalstatus.ts';

const sim = createSim(content);

describe('job bars', () => {
  it('gives a feller mid-tree a bar at the tree, more than 0 done and less than the total', () => {
    const w = createWorld(sim, 'smoke');
    let found = false;
    for (let m = 0; m < 3 * 1440 && !found; m += 1) {
      step(w, sim, 1);
      const feller = (w.entities['person'] ?? []).find(
        (p) => p['job'] === 'fell' && (p['work'] as number) > 0,
      );
      if (!feller || m % 2) continue;
      const tree = feller['target'] as number;
      if (tree < 0) continue;
      const bar = goodsOf(w).work.find(
        (b) => b.x === tree % w.map.width && b.y === Math.floor(tree / w.map.width),
      );
      if (!bar) continue;
      found = true;
      expect(bar.done).toBeGreaterThan(0);
      expect(bar.total).toBeGreaterThan(bar.done);
    }
    expect(found).toBe(true);
  });
});

describe('metal status', () => {
  it('says no shaft yet when tin is wanted and none is planned, and plates carry the line', () => {
    const w = createWorld(sim, 'smoke');
    expect(metalStatus(w, content, 'tin')).toBe('Nobody wants any');
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'tin-ingot', level: 'some' },
    });
    step(w, sim, 1);
    expect(metalStatus(w, content, 'tin')).toBe('No shaft yet: no tin stain found');
    const plate = stockView(w).find((s) => s.good === 'tin-ingot')!;
    expect(plate.status).toBe(metalStatus(w, content, 'tin'));
    expect(stockView(w).find((s) => s.good === 'logs')!.status).toBeUndefined();
  });
});
