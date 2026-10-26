// 5B Bundle 3 part 2a (V-132): a smokehouse is sited from the meat and fish that spoiled, with its
// reason citing a weekly spoil line; a curer smokes (or salts) a batch of fresh fish unordered; a
// cooper makes a barrel at the bench and puts it under the biggest spoiling larder stack; and a
// winter of cured food and barrels loses less than the same food left as it was.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { addEntity } from '../entity/index.ts';
import { freeTile, haveOf, layItem, storeOf } from '../goods/index.ts';
import { keepSystem } from '../keep/index.ts';
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

// No pasture, no accidents, and no cooking (the cooks would take the fish): only the cure and the
// cooper work on the larder's food.
const content = withoutAccidents({
  ...game,
  flock: { ...game.flock, tame: { ...game.flock.tame, species: [] } },
  work: { ...game.work, cook: { ...game.work.cook, perPerson: 0 } },
});
const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const food = (w: World) =>
  itemsOf(w)
    .filter((i) => content.life.eat[i['kind'] as string] !== undefined)
    .reduce((n, i) => n + (i['count'] as number), 0);

const lay = (w: World, kind: string, count: number, x: number, y: number) => {
  const id = layItem(w, { kind, count, x, y, z: 0, made: 1 });
  return itemsOf(w).find((i) => i.id === id)!;
};

/** A built larder 6 tiles east of the start (inside: x+7..x+9, y+1..y+2). */
function withLarder(seed = 'ledger'): { w: World; x: number; y: number } {
  const w = createWorld(sim, seed);
  const { startX: x, startY: y } = w.map;
  addEntity(w, 'depot', {
    ...{ store: 'larder', x: x + 6, y, z: 0, w: 5, h: 4, state: 'built', line: 1, built: 1 },
    builtTick: 1,
  });
  return { w, x, y };
}

/** The top-left of a free `size` square near the start, west of the town's middle. */
function freeSquare(w: World, size: number): { x: number; y: number } {
  for (let r = 3; r < 14; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= -2; dx += 1) {
        const [x, y] = [w.map.startX + dx, w.map.startY + dy];
        let free = true;
        for (let j = 0; j < size; j += 1)
          for (let i = 0; i < size; i += 1) free &&= freeTile(w, content, x + i, y + j);
        if (free) return { x, y };
      }
  throw new Error('no free ground');
}

/** A smokehouse standing, firewood in the store and `fish` fresh fish (and `salt`) in a store. */
function withSmokehouse(salt: number): World {
  const { w, x, y } = withLarder();
  const at = freeSquare(w, 2);
  addEntity(w, 'station', {
    ...{ kind: 'smokehouse', x: at.x, y: at.y, z: 0, w: 2, h: 2, state: 'built', line: 1 },
    ...{ have: 8, work: 0, made: 1, lit: 0, litLine: 0, alert: 0, waitFor: '' },
  });
  lay(w, 'fish', 10, x + 7, y + 1);
  lay(w, 'firewood', 6, x + 8, y + 1);
  if (salt) lay(w, 'salt', salt, x + 9, y + 1);
  return w;
}

/** Steps until a line of `type` appears (an hour at a time), at most `days` days. */
function until(w: World, type: string, days: number): number {
  for (let h = 0; h < days * 24; h += 1)
    for (const e of step(w, sim, 60)) if (e.type === type) return e.id;
  return 0;
}

describe('curing and barrels', () => {
  it('sites a smokehouse from the fresh meat and fish that spoiled, citing the spoil line', () => {
    const { w, x, y } = withLarder();
    lay(w, 'fish', 100, x - 8, y);
    const ctx = contextFor(w, sim, keepSystem);
    w.systems['weather']!['temp'] = 15;
    for (let d = 1; d <= 14; d += 1) {
      w.tick = d * DAY;
      keepSystem.run!(ctx);
    }
    const planned = lines(w, 'cure.housePlanned');
    expect(planned).toHaveLength(1);
    expect(String(planned[0]!.data['why'])).toMatch(
      /^\d+ fresh meat and fish spoiled in four weeks$/,
    );
    const spoil = lines(w, 'keep.spoiledOpen')[0]!;
    expect(planned[0]!.causes).toEqual([spoil.id]);
    const house = (w.entities['station'] ?? []).find((s) => s['kind'] === 'smokehouse')!;
    expect(house['state']).toBe('plan');
    expect([house['w'], house['h']]).toEqual([2, 2]);
    expect(Math.abs((house['x'] as number) - (x + 8))).toBeLessThanOrEqual(8 + 2);
    expect(storeOf(w).some((s) => s['x'] === house['x'] && s['y'] === house['y'])).toBe(false);
  });

  it('smokes a batch of fish unordered, citing the take-up; with salt it is salt meat', () => {
    for (const salt of [0, 1]) {
      const w = withSmokehouse(salt);
      const cured = until(w, 'cure.cured', 3);
      expect(cured).toBeGreaterThan(0);
      const line = allLines(w).find((e) => e.id === cured)!;
      expect(line.data['count']).toBe(10);
      expect(line.data['what']).toBe(salt ? 'salt meat' : 'smoked meat');
      expect(whyOf(w, cured).map((c) => c.event.type)).toContain('work.tookUpCuring');
      expect(haveOf(w, content, salt ? 'salted' : 'smoked')).toBe(10);
      expect(haveOf(w, content, salt ? 'smoked' : 'salted')).toBe(0);
      expect(haveOf(w, content, 'fish')).toBe(0);
      expect(w.commandLog).toHaveLength(0);
    }
  });

  it('makes a barrel from two logs at the bench and casks the biggest spoiling larder stack', () => {
    const { w, x, y } = withLarder();
    const at = freeSquare(w, 1);
    addEntity(w, 'furniture', {
      ...{ kind: 'bench', x: at.x, y: at.y, z: 0, facing: 's', quality: 4, maker: 0, owner: 0 },
      ...{ made: 1, line: 1, state: 'built', have: 0, work: -1, waited: 0 },
    });
    const big = lay(w, 'berries', 80, x + 7, y + 1);
    lay(w, 'berries', 30, x + 8, y + 1);
    // Logs over the Wood plate, in the store.
    lay(w, 'logs', 25, x + 9, y + 1);
    lay(w, 'logs', 25, x + 9, y + 2);
    lay(w, 'logs', 25, x + 8, y + 2);
    const barrelled = until(w, 'cure.barrelled', 3);
    expect(barrelled).toBeGreaterThan(0);
    expect(whyOf(w, barrelled).map((c) => c.event.type)).toContain('work.tookUpCoopering');
    const casks = w.entities['cask'] ?? [];
    expect(casks).toHaveLength(1);
    expect([casks[0]!['x'], casks[0]!['y'], casks[0]!['barrels']]).toEqual([big['x'], big['y'], 1]);
    expect(haveOf(w, content, 'barrel')).toBe(0);
  });

  it('loses less over a twelve-week winter with half the meat smoked and barrels on the roots', () => {
    const lost: number[] = [];
    for (const cured of [true, false]) {
      const { w, x, y } = withLarder();
      for (const i of [...itemsOf(w)]) if (content.life.eat[i['kind'] as string]) i['count'] = 0;
      w.entities['item'] = itemsOf(w).filter((i) => (i['count'] as number) > 0);
      lay(w, 'turnips', 120, x + 7, y + 1);
      lay(w, 'cabbages', 80, x + 8, y + 1);
      lay(w, 'meat', cured ? 30 : 60, x + 9, y + 1);
      if (cured) {
        lay(w, 'smoked', 30, x + 7, y + 2);
        for (const dx of [7, 8])
          addEntity(w, 'cask', { x: x + dx, y: y + 1, z: 0, barrels: 2, line: 1 });
      }
      const before = food(w);
      const ctx = contextFor(w, sim, keepSystem);
      w.systems['weather']!['temp'] = 5;
      for (let d = 1; d <= 84; d += 1) {
        w.tick = d * DAY;
        keepSystem.run!(ctx);
      }
      lost.push(before - food(w));
    }
    console.log(`cured winter, food lost in 12 weeks: ${lost[0]} with, ${lost[1]} without`);
    expect(lost[0]).toBeLessThan(lost[1]!);
  });
});
