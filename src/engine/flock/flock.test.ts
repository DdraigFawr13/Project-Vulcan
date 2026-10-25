// Phase 5 Bundle 3 (flocks and hay): the player-visible rules of the flock engine. Worlds are put
// at a date by setting the tick and running the flock system on that minute, not by long runs.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { grazingTiles } from '../build/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  emit,
  itemsOf,
  step,
  streamFor,
  templatesOf,
  type EntityRow,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { openFlock } from './index.ts';
import { findPath } from '../paths/index.ts';
import { animalsOf, herdsOf, packOf, spareCount } from '../wild/index.ts';
import {
  addToRick,
  butcher,
  flockSystem,
  foldFlock,
  headOf,
  keptOf,
  marked,
  mowable,
  takeIn,
} from './index.ts';

const DAY = 1440;
const MONTH = 28 * DAY;
const sim = createSim(content);
const lines = (w: WorldState, type: string) => allLines(w).filter((l) => l.type === type);
const typeOf = (w: WorldState, id: number) => allLines(w).find((l) => l.id === id)?.type;
const ctxOf = (w: WorldState): SystemContext => ({
  world: w,
  content,
  state: w.systems['flock']!,
  rng: () => streamFor(w, 'flock'),
  emit: (type, fields) => emit(w, templatesOf(content.events), type, fields),
});
/** Sets the clock to `month` (0-based), `day` (1-based) at hh:mm and runs the flock system there. */
const at = (w: WorldState, month: number, day: number, hh = 0, mm = 0) => {
  w.tick = month * MONTH + (day - 1) * DAY + hh * 60 + mm;
  flockSystem.run!(ctxOf(w));
};

/** A world with a built pasture on open ground near the green and its flock row. */
function pastureWorld(seed = 'anvil/1') {
  const w = createWorld(sim, seed);
  const map = w.map;
  const free = (x: number, y: number, ww: number, hh: number) => {
    for (let ty = y; ty < y + hh; ty += 1)
      for (let tx = x; tx < x + ww; tx += 1) {
        const t = map.tiles[ty * map.width + tx]!;
        if (content.terrain.kinds[t]!.water || tx < 0 || ty < 0) return false;
      }
    return true;
  };
  let spot: [number, number] | undefined;
  for (let r = 12; r < 40 && !spot; r += 1)
    for (let dx = -r; dx <= r && !spot; dx += 1) {
      const [x, y] = [map.startX + dx, map.startY - r];
      if (free(x, y, 24, 11)) spot = [x, y];
    }
  const [x, y] = spot!;
  const id = addEntity(w, 'pasture', {
    ...{ x, y, w: 11, h: 10, corner: 'nw', fold: 4, gate: y * map.width + x + 5, foldGate: 0 },
    ...{ mx: x + 12, my: y, mw: 12, mh: 7, rick: (y + 8) * map.width + x + 12 },
    ...{ state: 'built', line: w.begunEvent, last: w.begunEvent, why: '', sent: 0, at: 0 },
  });
  at(w, 1, 8, 8);
  const flock = w.entities['flock']![0]!;
  return { w, flock, pasture: id };
}

/** Adds kept animals straight to the flock's herd of a species. */
function addKept(
  w: WorldState,
  flock: EntityRow,
  rows: [kind: string, sex: string, young: number][],
) {
  const kd = content.flock.kinds[0]!;
  let herd = herdsOf(w).find((h) => h['kept'] === flock['pasture']);
  if (!herd) {
    const id = addEntity(w, 'herd', {
      ...{ species: kd.species, x: 0, y: 0, radius: 0, start: 0, line: w.begunEvent },
      ...{ taken: 0, lost: 0, byPack: 0, bySnow: 0, low: 0, kept: flock['pasture'] as number },
    });
    herd = herdsOf(w).find((h) => h.id === id)!;
  }
  const p = w.entities['pasture']!.find((q) => q.id === flock['pasture'])!;
  const tile = grazingTiles(w.map.width, p)[0]!;
  for (const [kind, sex, young] of rows)
    addEntity(w, 'animal', {
      ...{ herd: herd.id, pack: 0, kind, x: tile % w.map.width, y: Math.floor(tile / w.map.width) },
      ...{ z: 0, path: [], stride: 0, facing: 'e', state: '', until: 0 },
      ...{ sex, born: young ? w.tick : 0, young, tamedBy: 0, cull: 0, shorn: 0, dies: 0 },
    });
}

describe('the flock', () => {
  it('takes wild sheep in, never below the wild spare', () => {
    const { w, flock } = pastureWorld();
    const herd = herdsOf(w).find((h) => h['species'] === 'sheep' && !h['kept'])!;
    const wild = () => animalsOf(w).filter((a) => a['herd'] === herd.id);
    const before = wild().length;
    expect(before).toBeGreaterThan(spareCount(content));
    const person = w.entities['person']![0]!.id;
    let made = 0;
    for (const a of [...wild()]) {
      if (takeIn(ctxOf(w), flock, a, person, w.begunEvent)) made += 1;
    }
    expect(wild()).toHaveLength(spareCount(content));
    expect(headOf(w, flock)).toBe(before - spareCount(content));
    expect(made).toBe(before - spareCount(content));
    const tamed = lines(w, 'flock.tamed');
    expect(tamed).toHaveLength(made);
    expect(tamed[0]!.actors).toEqual([person]);
    expect(herd['taken']).toBe(made);
    expect(keptOf(w, flock).every((a) => a['tamedBy'] === person && a['cull'] === 0)).toBe(true);
    // Seedmonth is not a young-taking month: the animals come in grown, as ewes and rams.
    expect(
      keptOf(w, flock).every((a) => !a['young'] && ['ewe', 'ram'].includes(a['kind'] as string)),
    ).toBe(true);
  });

  it('says the pasture is full once, and takes nothing in', () => {
    const { w, flock } = pastureWorld();
    addKept(
      w,
      flock,
      Array.from({ length: content.flock.pasture.holds }, () => ['ewe', 'f', 0]),
    );
    const herd = herdsOf(w).find((h) => h['species'] === 'sheep' && !h['kept'])!;
    const wild = animalsOf(w).filter((a) => a['herd'] === herd.id);
    const full = takeIn(ctxOf(w), flock, wild[0]!, 0, w.begunEvent);
    expect(typeOf(w, full)).toBe('flock.full');
    expect(takeIn(ctxOf(w), flock, wild[1]!, 0, w.begunEvent)).toBe(0);
    expect(lines(w, 'flock.full')).toHaveLength(1);
    expect(animalsOf(w).filter((a) => a['herd'] === herd.id)).toHaveLength(wild.length);
  });

  it('lambs in Bloommonth when a ram is with the ewes, and not without one', () => {
    const { w, flock } = pastureWorld();
    addKept(w, flock, [
      ...Array.from({ length: 8 }, () => ['ewe', 'f', 0] as [string, string, number]),
      ['ram', 'm', 0],
    ]);
    const without = pastureWorld();
    addKept(
      without.w,
      without.flock,
      Array.from({ length: 8 }, () => ['ewe', 'f', 0]),
    );
    for (const world of [w, without.w]) {
      for (let d = 1; d <= 28; d += 1) at(world, 2, d);
    }
    const lambs = keptOf(w, flock).filter((a) => a['young']);
    expect(lambs.length).toBeGreaterThan(0);
    expect(lambs.every((a) => a['kind'] === 'lamb' && (a['born'] as number) >= 2 * MONTH)).toBe(
      true,
    );
    expect(lines(w, 'flock.lambed').length).toBeGreaterThan(0);
    expect(keptOf(without.w, without.flock).filter((a) => a['young'])).toHaveLength(0);
    expect(lines(without.w, 'flock.lambed')).toHaveLength(0);
    // Next Thawmonth the lambs are grown.
    at(w, 12, 1);
    expect(keptOf(w, flock).some((a) => a['young'])).toBe(false);
    expect(lines(w, 'flock.grown').length).toBeGreaterThan(0);
  });

  it('keeps floor(hay / 112) at the autumn count, with one ram, and butchers the rest', () => {
    const { w, flock } = pastureWorld();
    addKept(w, flock, [
      ...Array.from({ length: 7 }, () => ['ewe', 'f', 0] as [string, string, number]),
      ['ram', 'm', 0],
      ['ram', 'm', 0],
    ]);
    addToRick(ctxOf(w), flock, 560);
    at(w, 7, 1);
    const left = keptOf(w, flock).filter((a) => !a['cull']);
    expect(left).toHaveLength(5);
    expect(left.filter((a) => a['sex'] === 'm')).toHaveLength(1);
    const set = lines(w, 'flock.cullSet')[0]!;
    expect(set.data).toMatchObject({ hay: 560, keep: 5, cull: 4 });
    expect(marked(w, flock)).toHaveLength(4);
    const person = w.entities['person']![0]!.id;
    const victim = marked(w, flock)[0]!;
    const line = butcher(ctxOf(w), flock, victim, person);
    expect(typeOf(w, line)).toBe('flock.butchered');
    expect(headOf(w, flock)).toBe(8);
    expect(itemsOf(w).some((i) => i['kind'] === 'meat' && i['made'] === line)).toBe(true);
    expect(lines(w, 'wild.killed')).toHaveLength(0);
  });

  it('spoils a fifth of a swath on a wet day, and mows only after a dry night', () => {
    const { w, flock } = pastureWorld();
    (flock['swaths'] as number[]).push(5);
    (flock['swathHay'] as number[]).push(15);
    (flock['swathDry'] as number[]).push(0);
    w.systems['weather']!['wet'] = 1;
    at(w, 3, 5);
    expect(flock['swathHay']).toEqual([12]);
    expect(flock['spoiled']).toBe(3);
    expect(lines(w, 'flock.haySpoiled')[0]!.data['lost']).toBe(3);
    // A wet day then a dry one: no mowing day. Two dry days: the 06:00 after is one.
    at(w, 3, 5, 6);
    expect(mowable(w, content, flock)).toHaveLength(0);
    w.systems['weather']!['wet'] = 0;
    at(w, 3, 6);
    at(w, 3, 6, 6);
    expect(mowable(w, content, flock)).toHaveLength(0);
    at(w, 3, 7);
    at(w, 3, 7, 6);
    expect(mowable(w, content, flock)).toHaveLength(12 * 7);
  });

  it('puts the flock on hay when snow lies on the pasture, and back on grass at the thaw', () => {
    const { w, flock, pasture } = pastureWorld();
    addKept(
      w,
      flock,
      Array.from({ length: 4 }, () => ['ewe', 'f', 0]),
    );
    addToRick(ctxOf(w), flock, 100);
    const p = w.entities['pasture']!.find((q) => q.id === pasture)!;
    for (const t of grazingTiles(w.map.width, p)) w.map.snowLie[t] = 1;
    at(w, 8, 3);
    expect(flock['onHay']).toBe(1);
    expect(flock['hay']).toBe(96);
    expect(lines(w, 'flock.onHay')).toHaveLength(1);
    at(w, 0, 1);
    expect(flock['onHay']).toBe(0);
    expect(lines(w, 'flock.onGrass')).toHaveLength(1);
  });
});

/** An open tile 8 to 14 tiles from (cx, cy) with a way to it. */
function denNear(w: WorldState, cx: number, cy: number): [number, number] {
  for (let r = 8; r <= 14; r += 1)
    for (let dx = -r; dx <= r; dx += 1) {
      const [x, y] = [cx + dx, cy + r];
      const way = findPath(content, w.map, { x, y, z: 0 }, { x: cx, y: cy, z: 0 });
      if (way && !content.terrain.kinds[w.map.tiles[y * w.map.width + x]!]!.water) return [x, y];
    }
  throw new Error('no den site');
}

describe('a flock out at night with a hungry pack', () => {
  /** A world an hour before dusk (the pack's `night.from`) with a flock of four, the pack hungry
   * and its den a few tiles off. */
  function night(folded: boolean, hunger = 14) {
    const { w, flock, pasture } = pastureWorld();
    addKept(
      w,
      flock,
      Array.from({ length: 4 }, () => ['ewe', 'f', 0]),
    );
    if (folded) foldFlock(ctxOf(w), flock, 0);
    else openFlock(ctxOf(w), flock, 0);
    const p = w.entities['pasture']!.find((q) => q.id === pasture)!;
    const [dx, dy] = denNear(w, (p['x'] as number) + 5, (p['y'] as number) + 5);
    const pack = packOf(w)!;
    Object.assign(pack, { hunger, hungryLine: pack['line'], denX: dx, denY: dy });
    for (const a of animalsOf(w).filter((a) => a['pack']))
      Object.assign(a, { x: dx, y: dy, path: [] });
    // Nobody herds (the people side would otherwise fold it: people herd.test.ts).
    for (const person of w.entities['person']!) person['status'] = 'dead';
    w.tick = 7 * MONTH + (content.wild.pack.night.from - 1) * 60;
    step(w, sim, 4 * 60);
    return { w, flock, pack };
  }

  it('loses one, citing the hunger and the leftOut lines, and the pack is fed', () => {
    const { w, flock, pack } = night(false);
    expect(lines(w, 'flock.leftOut')).toHaveLength(1);
    expect(lines(w, 'flock.leftOut')[0]!.data['why']).toBe(content.flock.why['none']);
    const taken = lines(w, 'flock.taken');
    expect(taken).toHaveLength(1);
    expect(taken[0]!.causes).toEqual([pack['hungryLine'], flock['outLine']]);
    expect(typeOf(w, taken[0]!.causes[0]!)).not.toBeUndefined();
    expect(headOf(w, flock)).toBe(3);
    expect(pack['hunger']).toBe(0);
    expect(pack['visiting']).toBe(0);
  });

  it('never takes from a folded flock while the pack is not starving', () => {
    const { w, flock, pack } = night(true);
    expect(lines(w, 'flock.taken')).toHaveLength(0);
    expect(lines(w, 'flock.leftOut')).toHaveLength(0);
    expect(headOf(w, flock)).toBe(4);
    expect(pack['hunger']).toBe(14);
  });

  it('breaks into a dark fold once the pack has gone `watch.breakIn` days without a kill', () => {
    const { w, flock, pack } = night(true, content.flock.watch.breakIn + 2);
    const broke = lines(w, 'flock.brokeIn');
    expect(broke).toHaveLength(1);
    expect(broke[0]!.causes[0]).toBe(pack['hungryLine']);
    expect(lines(w, 'flock.taken')).toHaveLength(0);
    expect(headOf(w, flock)).toBe(3);
    expect(pack['hunger']).toBe(0);
  });
});
