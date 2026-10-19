// P4.9: the colony has only what someone can get to. Logs shut in by trees and a wall (anvil, a
// year with no felling and the fires out in Lastsnow) do not count towards the wood plate.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld } from '../index.ts';
import { canReach, walkAt } from '../paths/index.ts';
import { haveOf, layItem } from './index.ts';

describe('what the colony has', () => {
  it('counts a stack lying where nobody can reach it as not had', () => {
    const w = createWorld(createSim(content), 'anvil');
    const map = w.map;
    const green = { x: map.startX, y: map.startY, z: 0 };
    const before = haveOf(w, content, 'logs');
    // The first open surface tile nobody can walk to from the green, and one they can.
    let shut: { x: number; y: number } | undefined;
    for (let i = 0; i < map.width * map.height && !shut; i += 1) {
      const at = { x: i % map.width, y: Math.floor(i / map.width), z: 0 };
      if (walkAt(content, map, 0, i) && !canReach(content, map, green, at)) shut = at;
    }
    expect(shut).toBeDefined();
    layItem(w, { kind: 'logs', count: 20, ...shut!, z: 0, made: 1 });
    expect(haveOf(w, content, 'logs')).toBe(before);
    layItem(w, { kind: 'logs', count: 20, x: map.startX, y: map.startY + 1, z: 0, made: 1 });
    expect(haveOf(w, content, 'logs')).toBe(before + 20);
  });
});
