// The watch fire (Phase 5A Bundle 6): after a sign of the pack the best-placed herder sits up by a
// fire at the fold and the pack keeps clear; with no firewood nobody watches and a starving pack
// breaks into the dark fold. Worlds are put at a date by setting the tick and stepping the sim.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { grazingTiles } from '../build/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  emit,
  step,
  streamFor,
  templatesOf,
  type EntityRow,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { flockSystem, foldFlock, headOf } from '../flock/index.ts';
import { itemsOf, layItem, storeOf } from '../goods/index.ts';
import { findPath, walkAt } from '../paths/index.ts';
import { animalsOf, packOf } from '../wild/index.ts';

const DAY = 1440;
const MONTH = 28 * DAY;
const sim = createSim(content);
const lines = (w: WorldState, type: string) => allLines(w).filter((l) => l.type === type);
const ctxOf = (w: WorldState): SystemContext => ({
  world: w,
  content,
  state: w.systems['flock']!,
  rng: () => streamFor(w, 'flock'),
  emit: (type, fields) => emit(w, templatesOf(content.events), type, fields),
});

/** A world at 15:00 with a pasture north of the start, four ewes folded, the
 * first person herding first, the pack 22 days hungry with its den near, and a sign yesterday. */
function watchNight(firewood: number) {
  const w = createWorld(sim, 'anvil/1');
  const map = w.map;
  const free = (x: number, y: number) => {
    for (let ty = y; ty < y + 11; ty += 1)
      for (let tx = x; tx < x + 24; tx += 1)
        if (content.terrain.kinds[map.tiles[ty * map.width + tx]!]!.water) return false;
    return true;
  };
  let spot: [number, number] | undefined;
  for (let r = 12; r < 40 && !spot; r += 1)
    for (let dx = -r; dx <= r && !spot; dx += 1)
      if (free(map.startX + dx, map.startY - r)) spot = [map.startX + dx, map.startY - r];
  const [x, y] = spot!;
  addEntity(w, 'pasture', {
    ...{ x, y, w: 11, h: 10, corner: 'nw', fold: 4, gate: y * map.width + x + 5 },
    ...{ foldGate: (y + 2) * map.width + x + 5, mx: x + 12, my: y, mw: 12, mh: 7 },
    ...{ rick: (y + 8) * map.width + x + 12, state: 'built', line: w.begunEvent },
    ...{ last: w.begunEvent, why: '', sent: 0, at: 0 },
  });
  w.tick = 9 * MONTH + 7 * DAY + 15 * 60;
  flockSystem.run!(ctxOf(w));
  const flock = w.entities['flock']![0]!;
  const pasture = w.entities['pasture']![0]!;
  const herd = addEntity(w, 'herd', {
    ...{ species: 'sheep', x: 0, y: 0, radius: 0, start: 0, line: w.begunEvent },
    ...{ taken: 0, lost: 0, byPack: 0, bySnow: 0, low: 0, kept: pasture.id },
  });
  const tile = grazingTiles(map.width, pasture).find((t) => walkAt(content, map, 0, t) > 0)!;
  for (let k = 0; k < 4; k += 1)
    addEntity(w, 'animal', {
      ...{ herd, pack: 0, kind: 'ewe', x: tile % map.width, y: Math.floor(tile / map.width) },
      ...{ z: 0, path: [], stride: 0, facing: 'e', state: '', until: 0 },
      ...{ sex: 'f', born: 0, young: 0, tamedBy: 0, cull: 0, shorn: 0, dies: 0 },
    });
  foldFlock(ctxOf(w), flock, 0);
  const [first, ...rest] = w.entities['person']!;
  const row = (p: EntityRow, level: number) =>
    addEntity(w, 'priority', { person: p.id, job: 'herd', level, line: w.begunEvent, declined: 0 });
  row(first!, 1);
  for (const p of rest) row(p, content.work.priority.words.length);
  for (const i of itemsOf(w).filter((i) => i['kind'] === 'firewood')) i['count'] = 0;
  const store = storeOf(w)[0]!;
  if (firewood)
    layItem(w, {
      kind: 'firewood',
      count: firewood,
      x: store['x'] as number,
      y: store['y'] as number,
      z: 0,
      made: w.begunEvent,
    });
  // The den south of the pasture, a walk away.
  const [cx, cy] = [x + 5, y + 5];
  let den: [number, number] | undefined;
  for (let r = 14; r <= 22 && !den; r += 1)
    for (let dx = -r; dx <= r && !den; dx += 1) {
      const [dx0, dy0] = [cx + dx, cy - r];
      if (dy0 < 0 || content.terrain.kinds[map.tiles[dy0 * map.width + dx0]!]!.water) continue;
      if (findPath(content, map, { x: dx0, y: dy0, z: 0 }, { x: cx, y: cy, z: 0 }))
        den = [dx0, dy0];
    }
  const pack = packOf(w)!;
  Object.assign(pack, { hunger: 22, hungryLine: pack['line'], denX: den![0], denY: den![1] });
  for (const a of animalsOf(w).filter((a) => a['pack']))
    Object.assign(a, { x: den![0], y: den![1], path: [] });
  Object.assign(w.systems['people']!, { signAt: w.tick - DAY, signLine: pack['line'] });
  return { w, flock, pack, watcher: first! };
}

describe('the watch fire', () => {
  it('a herder sits up by a fire at the fold, the pack draws off, and the watcher sleeps late', () => {
    const { w, flock, pack, watcher } = watchNight(20);
    step(w, sim, 7 * 60);
    const lit = lines(w, 'flock.watchLit');
    expect(lit).toHaveLength(1);
    expect(lit[0]!.actors).toEqual([watcher.id]);
    const warded = lines(w, 'wild.packWarded');
    expect(warded).toHaveLength(1);
    expect(warded[0]!.causes[0]).toBe(lit[0]!.id);
    expect(lines(w, 'flock.brokeIn')).toHaveLength(0);
    expect(headOf(w, flock)).toBe(4);
    expect(pack['hunger']).toBe(22);
    // First light, then mid-morning: the fire is out and the watcher still abed.
    step(w, sim, 12 * 60);
    expect(lines(w, 'flock.watchEnded')).toHaveLength(1);
    expect(flock['watch']).toBe(0);
    expect(watcher['doing']).toBe('sleep');
  });

  it('with no firewood nobody watches, and a starving pack breaks into the dark fold', () => {
    const { w, flock } = watchNight(0);
    step(w, sim, 7 * 60);
    expect(lines(w, 'flock.watchLit')).toHaveLength(0);
    expect(lines(w, 'flock.noWatch')).toHaveLength(1);
    expect(lines(w, 'flock.brokeIn')).toHaveLength(1);
    expect(headOf(w, flock)).toBe(3);
  });
});
