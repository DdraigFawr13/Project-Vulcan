// 5B Bundle 3 part 2d (V-132): a kiln is sited at the edge of town from the grain that spoiled,
// citing the spoil line; a potter throws a pot from clay at a built kiln and sets it under the
// biggest grain stack, whose loss it halves; once a kiln stands and clay is plentiful, a new
// house is sited with brick walls and the potter fires bricks for it.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { greenOf } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { layItem, storeOf } from '../goods/index.ts';
import { floorsOf, keepSystem, rateOf } from '../keep/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  itemsOf,
  step,
  whyOf,
  withoutAccidents,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';

// No pasture, no accidents and no cooking: only the potter works on the granary's grain.
const content = withoutAccidents({
  ...game,
  flock: { ...game.flock, tame: { ...game.flock.tame, species: [] } },
  work: { ...game.work, cook: { ...game.work.cook, perPerson: 0 } },
});
const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

const lay = (w: World, kind: string, count: number, x: number, y: number) => {
  const id = layItem(w, { kind, count, x, y, z: 0, made: 1 });
  return itemsOf(w).find((i) => i.id === id)!;
};

/** A built granary 6 tiles east of the start (inside: x+7..x+10, y+1..y+3). */
function withGranary(seed = 'ledger'): { w: World; x: number; y: number } {
  const w = createWorld(sim, seed);
  const { startX: x, startY: y } = w.map;
  addEntity(w, 'depot', {
    ...{ store: 'granary', x: x + 6, y, z: 0, w: 6, h: 5, state: 'built', line: 1, built: 1 },
    builtTick: 1,
  });
  return { w, x, y };
}

/** A built kiln two tiles square at (x, y), as the builders would leave it. */
const kilnAt = (w: World, x: number, y: number) =>
  addEntity(w, 'station', {
    ...{ kind: 'kiln', x, y, z: 0, w: 2, h: 2, state: 'built', line: 1 },
    ...{ have: 8, work: 0, made: 1, lit: 0, litLine: 0, alert: 0, waitFor: '' },
  });

/** Steps until a line of `type` appears (an hour at a time), at most `days` days. */
function until(w: World, type: string, days: number): number {
  for (let h = 0; h < days * 24; h += 1)
    for (const e of step(w, sim, 60)) if (e.type === type) return e.id;
  return 0;
}

describe('the potter and the kiln', () => {
  it('sites a kiln at the edge of town from the grain that spoiled, citing the spoil line', () => {
    const { w, x, y } = withGranary();
    for (let i = 0; i < 12; i += 1)
      lay(w, 'grain', 2000, x + 7 + (i % 4), y + 1 + Math.floor(i / 4));
    lay(w, 'clay', 20, x - 8, y);
    const ctx = contextFor(w, sim, keepSystem);
    w.systems['weather']!['temp'] = 15;
    for (let d = 1; d <= 14; d += 1) {
      w.tick = d * DAY;
      keepSystem.run!(ctx);
    }
    const planned = lines(w, 'potter.kilnPlanned');
    expect(planned).toHaveLength(1);
    expect(String(planned[0]!.data['why'])).toMatch(/^\d+ grain and roots spoiled in the stores/);
    expect(planned[0]!.data['where']).toBe('at the edge of town');
    const spoil = lines(w, 'keep.spoiled').find((e) => planned[0]!.causes.includes(e.id));
    expect(spoil).toBeDefined();
    const kiln = (w.entities['station'] ?? []).find((s) => s['kind'] === 'kiln')!;
    expect(kiln['state']).toBe('plan');
    const green = greenOf(w);
    const ring = Math.max(
      Math.abs((kiln['x'] as number) - green.x),
      Math.abs((kiln['y'] as number) - green.y),
    );
    expect(ring).toBeGreaterThanOrEqual(content.work.potter.kiln.near[0]! - 1);
    expect(ring).toBeLessThanOrEqual(content.work.potter.kiln.near[1]! + 1);
  });

  it('throws a pot from two clay at a built kiln and sets it under the biggest grain stack', () => {
    const { w, x, y } = withGranary();
    const kx = x - 6;
    kilnAt(w, kx, y);
    const big = lay(w, 'grain', 100, x + 7, y + 1);
    lay(w, 'grain', 40, x + 8, y + 1);
    lay(w, 'clay', 2, x + 9, y + 1);
    lay(w, 'firewood', 6, x + 10, y + 1);
    const floors = floorsOf(w, content);
    const bare = rateOf(w, content, big, floors);
    expect(bare).toBeGreaterThan(0);
    const potted = until(w, 'potter.potted', 3);
    expect(potted).toBeGreaterThan(0);
    expect(whyOf(w, potted).map((c) => c.event.type)).toContain('work.tookUpPottery');
    const casks = w.entities['cask'] ?? [];
    expect(casks).toHaveLength(1);
    expect([casks[0]!['x'], casks[0]!['y'], casks[0]!['pots']]).toEqual([big['x'], big['y'], 1]);
    expect(itemsOf(w).some((i) => i['kind'] === 'pot')).toBe(false);
    // The pot covers 100 of it: a stack of that size or less loses half as fast.
    expect(big['count'] as number).toBeLessThanOrEqual(100);
    expect(rateOf(w, content, big, floors)).toBeCloseTo(bare / 2, 10);
  });

  it('sites a new house with brick walls once a kiln stands and clay is plentiful, and fires bricks', () => {
    const w = createWorld(sim, 'ledger');
    const home = storeOf(w)[0]!;
    const [hx, hy] = [home['x'] as number, home['y'] as number];
    kilnAt(w, w.map.startX - 7, w.map.startY);
    lay(w, 'clay', 20000, hx, hy);
    lay(w, 'firewood', 40, hx, hy);
    const fired = until(w, 'potter.fired', 8);
    const sited = lines(w, 'build.sited')[0]!;
    expect(String(sited.data['why'])).toBe(
      'brick walls, as brick is most plentiful and enough to finish it',
    );
    expect(fired).toBeGreaterThan(0);
    const took = lines(w, 'work.tookUpPottery').find((e) =>
      whyOf(w, fired).some((c) => c.event.id === e.id),
    )!;
    expect(String(took.data['why'])).toMatch(/^the .+ wants bricks for its walls$/);
    expect(allLines(w).find((e) => e.id === fired)!.data['count']).toBe(4);
  });
});
