// 5B Bundle 3 part 2b (V-041, V-132): every seed has a salt seam on level 2 with a white stain on
// the surface; with a smokehouse, fresh fish in the stores and no salt, the mine plans a shaft by
// the nearest white stain (citing the smokehouse or the curer), miners dig it, and the salt that
// reaches a store goes into the next batch the curer makes.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { addEntity } from '../entity/index.ts';
import { freeTile, haveOf, inStore, layItem } from '../goods/index.ts';
import { allLines, createSim, createWorld, itemsOf, step, withoutAccidents } from '../index.ts';
import { makeLevel } from '../map/underground.ts';
import { shaftsOf } from './index.ts';

// No pasture, no accidents, no cooking, and a smokehouse that wants more firewood than anyone has
// (`cure.fuel`, set back to 2 where a test lets the curer work).
const cure = { ...game.work.cure, fuel: 9999 };
const content = withoutAccidents({
  ...game,
  flock: { ...game.flock, tame: { ...game.flock.tame, species: [] } },
  work: { ...game.work, cook: { ...game.work.cook, perPerson: 0 }, cure },
});
const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const SALT = content.features.findIndex((f) => f.id === 'salt') + 1;

const lay = (w: World, kind: string, count: number, x: number, y: number) =>
  layItem(w, { kind, count, x, y, z: 0, made: 1 });

/** Whether a white stain lies within `work.mine.near` tiles of (x, y). */
function stainedNear(w: World, x: number, y: number): boolean {
  const near = content.work.mine.near;
  for (let dy = -near; dy <= near; dy += 1)
    for (let dx = -near; dx <= near; dx += 1)
      if (w.map.stains[(y + dy) * w.map.width + x + dx] === SALT) return true;
  return false;
}

/** A built larder east of the start and a smokehouse on free ground west of it, with `fish` fresh
 * fish and `wood` firewood in the larder (no wood: nobody can smoke the fish). */
function withHouse(seed: string, fish: number, wood: number): World {
  const w = createWorld(sim, seed);
  const { startX: x, startY: y } = w.map;
  addEntity(w, 'depot', {
    ...{ store: 'larder', x: x + 6, y, z: 0, w: 5, h: 4, state: 'built', line: 1, built: 1 },
    builtTick: 1,
  });
  let at = { x, y };
  for (let r = 3; r < 14 && at.x === x; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= -2; dx += 1)
        if (
          at.x === x &&
          [0, 1].every((j) => [0, 1].every((i) => freeTile(w, content, x + dx + i, y + dy + j)))
        )
          at = { x: x + dx, y: y + dy };
  addEntity(w, 'station', {
    ...{ kind: 'smokehouse', x: at.x, y: at.y, z: 0, w: 2, h: 2, state: 'built', line: 1 },
    ...{ have: 8, work: 0, made: 1, lit: 0, litLine: 0, alert: 0, waitFor: '' },
  });
  lay(w, 'fish', fish, x + 7, y + 1);
  if (wood) lay(w, 'firewood', wood, x + 8, y + 1);
  return w;
}

describe('the salt seam', () => {
  it('lies on level 2 with a white stain on the surface, on every seed', () => {
    expect(SALT).toBeGreaterThan(0);
    expect(content.features[SALT - 1]!.vein).toMatchObject({ level: 2, stainWord: 'white' });
    for (const seed of ['anvil', 'smoke', 'tallow', 'ledger-1']) {
      const w = createWorld(sim, seed);
      const { features } = makeLevel(seed, content, w.map, 2);
      expect(features.some((f) => f === SALT)).toBe(true);
      expect(w.map.stains.some((s) => s === SALT)).toBe(true);
    }
  });

  it('plans a shaft by the nearest white stain when fish is stored, none is salted', () => {
    for (const seed of ['anvil', 'smoke', 'tallow', 'ledger-1']) {
      const w = withHouse(seed, 14, 0);
      step(w, sim, DAY);
      const shafts = shaftsOf(w).filter((s) => s['metal'] === 'salt');
      expect(shafts, seed).toHaveLength(1);
      const shaft = shafts[0]!;
      expect(stainedNear(w, shaft['x'] as number, shaft['y'] as number)).toBe(true);
      const line = allLines(w).find((e) => e.id === shaft['line'])!;
      expect(line.type).toBe('mine.shaftPlanned');
      expect(line.causes).toContain(1);
      expect(String(line.data['why'])).toMatch(
        /^Salt is wanted: 14 fresh meat and fish lie in the stores and none is salted\. This is by the nearest white stain past the town ring: \d+ tiles [\w-]+ of the green, on dry, level ground\.$/,
      );
    }
  });

  it('plans none with salt in a store or too little fish', () => {
    const salted = withHouse('smoke', 14, 0);
    lay(salted, 'salt', 3, salted.map.startX + 9, salted.map.startY + 1);
    const few = withHouse('smoke', 9, 0);
    for (const w of [salted, few]) {
      step(w, sim, DAY);
      expect(shaftsOf(w)).toHaveLength(0);
    }
  });
});

describe('mining the seam', () => {
  it('digs the seam, carries the salt to a store, and the next batch is salt meat', () => {
    const w = withHouse('smoke', 14, 0);
    const salt = () =>
      itemsOf(w)
        .filter((i) => i['kind'] === 'salt' && !i['holder'])
        .filter((i) => inStore(w, i['x'] as number, i['y'] as number, i['z'] as number))
        .reduce((n, i) => n + (i['count'] as number), 0);
    for (let d = 0; d < 20 && !salt(); d += 1) step(w, sim, DAY);
    expect(salt()).toBe(20);
    const mined = allLines(w).filter((e) => e.type === 'mine.veinMined');
    expect(mined).toHaveLength(1);
    expect(mined[0]!.data['what']).toBe('salt');
    const shaft = shaftsOf(w).find((s) => s['metal'] === 'salt')!;
    expect(shaft['state']).toBe('done');
    // No second shaft is planned while salt lies in the store, however the fish goes.
    step(w, sim, 5 * DAY);
    expect(shaftsOf(w).filter((s) => s['metal'] === 'salt')).toHaveLength(1);
    // Fresh fish and firewood for the curer: the batch is salted.
    cure.fuel = 2;
    const { startX: x, startY: y } = w.map;
    lay(w, 'fish', 12, x + 7, y + 2);
    lay(w, 'firewood', 6, x + 8, y + 2);
    let cured;
    for (let h = 0; h < 72 && !cured; h += 1)
      cured = step(w, sim, 60).find((e) => e.type === 'cure.cured');
    expect(cured?.data['what']).toBe('salt meat');
    expect(haveOf(w, content, 'salted')).toBe(10);
  }, 60_000);
});
