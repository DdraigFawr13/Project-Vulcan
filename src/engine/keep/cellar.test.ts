// 5B Bundle 3 part 2c (V-041, V-132): roots spoiling in a built larder get a cellar dug under it,
// planned from the spoil lines, dug by the miners (the stair sunk, then the larder's inside tiles
// on level 1), and when the last tile is dug it is a store of its own kind that keeps cooler.
// Nothing is faked: the run steps the real sim, with turnips that spoil fast so 20 are lost in
// four weeks (`items` below), no pasture, no accidents, no cooking and no barrel effect.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { addEntity } from '../entity/index.ts';
import { depotsOf, freeTile, layItem } from '../goods/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  itemsOf,
  step,
  whyOf,
  withoutAccidents,
} from '../index.ts';
import { diggable, makeLevel } from '../map/index.ts';
import { shaftsOf } from '../mine/index.ts';
import { floorsOf, rateOf } from './index.ts';

const content = withoutAccidents({
  ...game,
  flock: { ...game.flock, tame: { ...game.flock.tame, species: [] } },
  work: {
    ...game.work,
    cook: { ...game.work.cook, perPerson: 0 },
    // A barrel under the food would change the rates this compares.
    keep: { ...game.work.keep, barrel: { ...game.work.keep.barrel, times: 1 } },
  },
  items: game.items.map((i) => (i.id === 'turnips' ? { ...i, spoilPerMonth: 0.9 } : i)),
});
const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;

/** The first 5 by 4 spot east of the start on free ground whose inside tiles are earth below. */
function larderSpot(w: World): { x: number; y: number } {
  const { tiles } = makeLevel(w.seed, content, w.map, 1);
  const earth = (x: number, y: number) =>
    diggable(content.terrain.kinds[tiles[y * w.map.width + x]!]!);
  for (let r = 4; r < 24; r += 1)
    for (let dy = -r; dy <= r; dy += 1) {
      const [x, y] = [w.map.startX + r, w.map.startY + dy];
      const range = (n: number) => Array.from({ length: n }, (_, k) => k);
      const clear = range(5).every((i) =>
        range(4).every((j) => freeTile(w, content, x + i, y + j)),
      );
      if (clear && [1, 2, 3].every((i) => [1, 2].every((j) => earth(x + i, y + j))))
        return { x, y };
    }
  throw new Error('no free ground over earth');
}

/** A built larder with 240 turnips on its six inside tiles, stepped day by day until `type`
 * appears (at most `days`). */
function until(w: World, type: string, days: number): number {
  for (let d = 0; d < days; d += 1) {
    const hit = step(w, sim, DAY).find((e) => e.type === type);
    if (hit) return hit.id;
  }
  return 0;
}

const world = ((): (() => { w: World; x: number; y: number }) => {
  let made: { w: World; x: number; y: number } | undefined;
  return () => {
    if (made) return made;
    const w = createWorld(sim, 'ledger');
    const { x, y } = larderSpot(w);
    addEntity(w, 'depot', {
      ...{ store: 'larder', x, y, z: 0, w: 5, h: 4, state: 'built', line: 1, built: 1 },
      builtTick: 1,
    });
    for (const [dx, dy] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ] as const)
      layItem(w, { kind: 'turnips', count: 40, x: x + dx, y: y + dy, z: 0, made: 1 });
    return (made = { w, x, y });
  };
})();

describe('the cellar', () => {
  it('is planned under the larder from the spoil lines, and dug by the miners', () => {
    const { w, x, y } = world();
    const planned = until(w, 'keep.cellarPlanned', 60);
    expect(planned).toBeGreaterThan(0);
    const line = allLines(w).find((e) => e.id === planned)!;
    expect(String(line.data['why'])).toMatch(
      /^\d+ roots and berries spoiled in the larder in four weeks$/,
    );
    expect(Number(String(line.data['why']).split(' ')[0])).toBeGreaterThanOrEqual(20);
    const cites = line.causes.map((c) => allLines(w).find((e) => e.id === c)!.type);
    expect(cites).toEqual(['keep.spoiled']);
    const stair = shaftsOf(w).find((s) => s['metal'] === 'cellar')!;
    expect(stair['line']).toBe(planned);
    expect([stair['x'], stair['y']].map(Number)).toSatisfy(
      ([sx, sy]: number[]) => sx! > x && sx! < x + 4 && sy! > y && sy! < y + 3,
    );
    // Dug by colonists nobody orders: the stair sunk, then tiles dug, citing the plan.
    const dugAt = until(w, 'keep.cellarDug', 40);
    expect(dugAt).toBeGreaterThan(0);
    expect(whyOf(w, dugAt).map((c) => c.event.type)).toContain('keep.cellarPlanned');
    expect(allLines(w).filter((e) => e.type === 'mine.dug' && e.data['level'] === 1)).toHaveLength(
      5,
    );
    expect(w.commandLog).toHaveLength(0);
    const cellar = depotsOf(w).find((d) => d['store'] === 'cellar')!;
    expect([cellar['z'], cellar['x'], cellar['y'], cellar['w'], cellar['h']]).toEqual([
      1,
      x,
      y,
      5,
      4,
    ]);
    expect(cellar['state']).toBe('built');
  }, 60_000);

  it('is a store that takes the roots and keeps them cooler than the larder', () => {
    const { w, x, y } = world();
    until(w, 'keep.cellarDug', 100);
    step(w, sim, 3 * DAY);
    const below = itemsOf(w).filter((i) => i['kind'] === 'turnips' && i['z'] === 1);
    expect(below.length).toBeGreaterThan(0);
    // The same stack laid in the larder at the same weather loses more a day.
    w.systems['weather']!['temp'] = 15;
    const id = layItem(w, {
      kind: 'turnips',
      count: below[0]!['count'] as number,
      x: x + 1,
      y: y + 1,
      z: 0,
      made: 1,
    });
    const above = itemsOf(w).find((i) => i.id === id)!;
    const floors = floorsOf(w, content);
    const [cool, warm] = [rateOf(w, content, below[0]!, floors), rateOf(w, content, above, floors)];
    expect(cool).toBeGreaterThan(0);
    expect(cool).toBeLessThan(warm / 2);
    // Its weekly line names it the cellar.
    step(w, sim, 7 * DAY);
    expect(allLines(w).some((e) => e.type === 'keep.spoiled' && e.data['place'] === 'cellar')).toBe(
      true,
    );
    // No second cellar is planned.
    expect(allLines(w).filter((e) => e.type === 'keep.cellarPlanned')).toHaveLength(1);
  }, 60_000);
});
