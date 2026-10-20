// Test mode levers (P2.4): a marked tree is felled before any other, a marked tile joins the
// store, and both refuse a tile that cannot take them.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, step, submitCommand } from '../index.ts';
import { freeTile, storeOf } from './store.ts';
import { isTree, marksOf } from './marks.ts';

const sim = createSim(content);

describe('test marks', () => {
  it('fells a marked tree first and adds a marked store tile', () => {
    const world = createWorld(sim, 'ledger');
    const { width, startX, startY } = world.map;
    // The tree farthest from camp within 30 tiles, which no one would choose first.
    let tree = -1;
    let far = -1;
    for (let i = 0; i < world.map.features.length; i += 1) {
      const d = Math.max(Math.abs((i % width) - startX), Math.abs(Math.floor(i / width) - startY));
      if (d <= 30 && d > far && isTree(world, content, i)) [tree, far] = [i, d];
    }
    const [tx, ty] = [tree % width, Math.floor(tree / width)];
    let open = { x: -1, y: -1 };
    for (let y = startY - 8; y <= startY + 8 && open.x < 0; y += 1)
      for (let x = startX - 8; x <= startX + 8; x += 1)
        if (freeTile(world, content, x, y)) {
          open = { x, y };
          break;
        }
    const tiles = storeOf(world).length;
    const orders = [
      { kind: 'markFell', data: { x: tx, y: ty } },
      { kind: 'markFell', data: { x: open.x, y: open.y } },
      { kind: 'markStore', data: open },
      { kind: 'markStore', data: { x: -1, y: 0 } },
    ];
    orders.forEach((o, n) => submitCommand(world, { tick: world.tick + 1 + n, ...o }));
    step(world, sim, 10);
    expect(marksOf(world)).toHaveLength(1);
    expect(storeOf(world)).toHaveLength(tiles + 1);
    const refused = world.log.filter((e) => e.type === 'command.refused');
    expect(refused.map((e) => e.data['kind'])).toEqual(['markFell', 'markStore']);
    // Two days: walking is half the Phase 4 speed (Morgan, Phase 4 review).
    step(world, sim, 2 * 1440);
    expect(world.log.some((e) => e.type === 'work.tookUpMarked')).toBe(true);
    expect(marksOf(world)).toHaveLength(0);
    expect(isTree(world, content, tree)).toBe(false);
  });
});
