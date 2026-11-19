// Vulcan bench S1 (Phobos spec vulcan-bench J1): the needs-ladder lines can be supplied from
// outside through a line hook, and with no hook, or one that gives today's line, nothing changes.
// That only lines.ts and needs/ read a seek line is a boundary rule: tools/tests/boundaries.test.ts.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, setLineHook, step, type LineHook } from '../index.ts';

const DAYS = 3 * 24 * 60;
const SEED = 'anvil';

/** Runs `SEED` for 3 game days a tick at a time under `hook`: its lines, world and eating minutes. */
function run(hook?: LineHook) {
  const sim = createSim(content);
  setLineHook(sim, hook);
  const world = createWorld(sim, SEED);
  const lines: unknown[] = [];
  let eating = 0;
  for (let t = 0; t < DAYS; t++) {
    lines.push(...step(world, sim, 1));
    for (const p of world.entities['person'] ?? []) if (p['doing'] === 'eat') eating++;
  }
  return { lines: JSON.stringify(lines), world: JSON.stringify(world), eating };
}

describe('the line hook', () => {
  const today = run();

  it('today-hook-is-no-hook: a hook giving today’s line changes no line and no world', () => {
    const same = run((_ctx, _p, _need, line) => line);
    expect(same.lines).toBe(today.lines);
    expect(same.world).toBe(today.world);
  });

  it('food-hook-changes-eating: food’s line 1500 higher means more minutes spent eating', () => {
    const raised = run((_ctx, _p, need, line) => (need === 'food' ? line + 1500 : line));
    // A higher line sends them to eat sooner and more often; any change at all was too weak a check.
    expect(raised.eating).toBeGreaterThan(today.eating);
  });
});
