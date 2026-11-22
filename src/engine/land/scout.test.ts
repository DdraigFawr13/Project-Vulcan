// 6W Slice 4 (V-205): the colony works only land it knows. When the known wood in reach runs out a
// scout goes out unordered, comes home and tells of a wood, the fellers work it, and every line
// traces back to the Wood stock level; no work is ever chosen on unknown ground.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { stockOf, storeOf } from '../goods/index.ts';
import { allLines, createSim, createWorld, step, submitCommand } from '../index.ts';

const sim = createSim(content);
const HOUR = 60;
const DAY = 1440;
type World = ReturnType<typeof createWorld>;

const cheb = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const storeAt = (w: World): [number, number] => {
  const s = storeOf(w)[0]!;
  return [s['x'] as number, s['y'] as number];
};
const kindAt = (w: World, i: number) =>
  w.map.features[i] ? content.features[w.map.features[i]! - 1]!.kind : '';

/** A colony whose near wood is gone (every tree and log within felling reach of the store cut
 * away) and who wants plenty of it: what it has and knows of is under the stock level. */
function woodless(seed: string): World {
  const w = createWorld(sim, seed);
  const [ox, oy] = storeAt(w);
  const reach = content.work.fell.reach;
  for (let i = 0; i < w.map.features.length; i += 1) {
    const [x, y] = [i % w.map.width, Math.floor(i / w.map.width)];
    if (cheb(x, y, ox, oy) <= reach && ['tree', 'log'].includes(kindAt(w, i)))
      w.map.features[i] = 0;
  }
  submitCommand(w, { tick: w.tick + 1, kind: 'setStock', data: { good: 'logs', level: 'plenty' } });
  return w;
}

describe('scouting', () => {
  // anvil first: the prototype's scouts there set out for a spot they never reached.
  for (const seed of ['anvil', 'ledger-1']) {
    it(`sends a scout when the known wood runs out, who comes home with a wood the fellers work, on ${seed}`, () => {
      const w = woodless(seed);
      const [ox, oy] = storeAt(w);
      // Where the trip set out for, and how near the scout came to it.
      let [target, nearest] = [undefined as { x: number; y: number } | undefined, Infinity];
      let told: ReturnType<typeof allLines>[number] | undefined;
      for (let t = 0; t < 12 * DAY && !told;) {
        // Minute by minute while a trip is under way, to see them reach the spot.
        const by = w.map.finds.at(-1)?.count === -1 ? 1 : 5;
        step(w, sim, by);
        t += by;
        const trip = w.map.finds.at(-1);
        if (trip?.count === -1 && !target) target = { x: trip.x, y: trip.y };
        for (const p of w.entities['person'] ?? [])
          if (p['job'] === 'scout' && p['task'] === 'out' && target)
            nearest = Math.min(
              nearest,
              cheb(p['x'] as number, p['y'] as number, target.x, target.y),
            );
        if (trip && trip.count >= 0) told = allLines(w).find((e) => e.type === 'land.toldOf');
      }
      expect(told).toBeDefined();
      // The trip set out for the wood the stock level wants, unordered, and came home.
      const out = allLines(w).find((e) => e.id === told!.causes[0])!;
      expect(out.type).toBe('work.tookUpScouting');
      expect(out.data['good']).toBe('wood');
      const level = allLines(w).find((e) => e.id === stockOf(w, 'logs')!['line'])!;
      expect(out.causes).toContain(level.id);
      expect(allLines(w).find((e) => e.id === level.causes[0])!.type).toBe('command.applied');
      expect(told!.tick - out.tick).toBeLessThan(2 * content.work.scout.leg * DAY);
      // They reached the spot they made for; the find lies past the felling reach.
      expect(nearest).toBeLessThanOrEqual(1);
      const find = w.map.finds.at(-1)!;
      expect(find.count).toBeGreaterThanOrEqual(content.terrain.generator.known.least);
      expect(cheb(find.x, find.y, ox, oy)).toBeGreaterThan(content.work.fell.reach);
      // Fellers take up the found wood within days.
      let worked = false;
      for (let h = 0; h < 6 * 24 && !worked; h += 1) {
        step(w, sim, HOUR);
        worked = (w.entities['person'] ?? []).some((p) => {
          const t = p['target'] as number;
          if (p['job'] !== 'fell' || t < 0) return false;
          return cheb(t % w.map.width, Math.floor(t / w.map.width), find.x, find.y) <= 12;
        });
      }
      expect(worked).toBe(true);
    });
  }

  it('never chooses work on ground nobody has seen', () => {
    // Only a few tiles round the green are known: everything chosen must lie on known ground.
    const w = createWorld(sim, 'tallow');
    const [sx, sy] = [w.map.startX, w.map.startY];
    w.map.known.fill(0);
    for (let i = 0; i < w.map.known.length; i += 1)
      if (cheb(i % w.map.width, Math.floor(i / w.map.width), sx, sy) <= 8) w.map.known[i] = 1;
    const before = new Set((w.entities['plan'] ?? []).map((r) => r.id));
    let [checked, unknown] = [0, 0];
    for (let t = 0; t < 4 * DAY; t += 10) {
      step(w, sim, 10);
      for (const p of w.entities['person'] ?? []) {
        const target = p['target'] as number;
        if (!['fell', 'quarry', 'forage', 'fish'].includes(p['job'] as string) || target < 0)
          continue;
        checked += 1;
        if (w.map.known[target] !== 1) unknown += 1;
      }
      for (const plan of w.entities['plan'] ?? []) {
        if (before.has(plan.id)) continue;
        const i = (plan['y'] as number) * w.map.width + (plan['x'] as number);
        checked += 1;
        if (w.map.known[i] !== 1) unknown += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(unknown).toBe(0);
  });
});
