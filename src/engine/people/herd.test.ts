// Herding (Phase 5 Bundle 3, V-041): who folds the flock, butchers, tames and mows, and why a flock
// is left out. Worlds are put at a date by setting the tick and stepping the whole sim a little.
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
import { flockSystem, headOf, keptOf, marked, tameTargets } from '../flock/index.ts';
import { itemsOf } from '../goods/index.ts';
import { memoriesOf } from '../needs/index.ts';
import { walkAt } from '../paths/index.ts';
import { animalsOf, herdsOf } from '../wild/index.ts';

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
/** Sets the clock to `month` (0-based), `day` (1-based) at hh:mm. */
const clock = (w: WorldState, month: number, day: number, hh = 0, mm = 0) => {
  w.tick = month * MONTH + (day - 1) * DAY + hh * 60 + mm;
};

/** A world with a built pasture (the fold gate on its inner wall) and its flock row. */
function pastureWorld() {
  const w = createWorld(sim, 'anvil/1');
  const map = w.map;
  const free = (x: number, y: number, ww: number, hh: number) => {
    for (let ty = y; ty < y + hh; ty += 1)
      for (let tx = x; tx < x + ww; tx += 1)
        if (content.terrain.kinds[map.tiles[ty * map.width + tx]!]!.water) return false;
    return true;
  };
  let spot: [number, number] | undefined;
  for (let r = 12; r < 40 && !spot; r += 1)
    for (let dx = -r; dx <= r && !spot; dx += 1) {
      const [x, y] = [map.startX + dx, map.startY - r];
      if (free(x, y, 24, 11)) spot = [x, y];
    }
  const [x, y] = spot!;
  addEntity(w, 'pasture', {
    ...{ x, y, w: 11, h: 10, corner: 'nw', fold: 4, gate: y * map.width + x + 5 },
    ...{ foldGate: (y + 2) * map.width + x + 5, mx: x + 12, my: y, mw: 12, mh: 7 },
    ...{ rick: (y + 8) * map.width + x + 12, state: 'built', line: w.begunEvent },
    ...{ last: w.begunEvent, why: '', sent: 0, at: 0 },
  });
  clock(w, 1, 8, 8);
  flockSystem.run!(ctxOf(w));
  const flock = w.entities['flock']![0]!;
  const pasture = w.entities['pasture']![0]!;
  return { w, flock, pasture };
}

/** Kept sheep on the pasture's grazing ground, tamed by `by`. */
function addKept(w: WorldState, flock: EntityRow, kinds: string[], by: number) {
  const id = addEntity(w, 'herd', {
    ...{ species: 'sheep', x: 0, y: 0, radius: 0, start: 0, line: w.begunEvent },
    ...{ taken: 0, lost: 0, byPack: 0, bySnow: 0, low: 0, kept: flock['pasture'] as number },
  });
  const p = w.entities['pasture']![0]!;
  const tile = grazingTiles(w.map.width, p).find((t) => walkAt(content, w.map, 0, t) > 0)!;
  for (const kind of kinds)
    addEntity(w, 'animal', {
      ...{ herd: id, pack: 0, kind, x: tile % w.map.width, y: Math.floor(tile / w.map.width) },
      ...{ z: 0, path: [], stride: 0, facing: 'e', state: '', until: 0 },
      ...{ sex: kind === 'ram' ? 'm' : 'f', born: 0, young: 0, tamedBy: by, cull: 0, shorn: 0 },
      dies: 0,
    });
}

/** Stands `p` on or beside tile (x, y), on open ground. */
function stand(w: WorldState, p: EntityRow, x: number, y: number) {
  for (let r = 0; r < 6; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1)
        if (walkAt(content, w.map, 0, (y + dy) * w.map.width + x + dx) > 0) {
          Object.assign(p, { x: x + dx, y: y + dy, z: 0, path: [] });
          return;
        }
}

/** Gives Herding to the first person and the lowest level to everyone else. */
function herder(w: WorldState): EntityRow {
  const [first, ...rest] = w.entities['person']!;
  const row = (p: EntityRow, level: number) =>
    addEntity(w, 'priority', { person: p.id, job: 'herd', level, line: w.begunEvent, declined: 0 });
  row(first!, 1);
  for (const p of rest) row(p, content.work.priority.words.length);
  return first!;
}

const gate = (w: WorldState, pasture: EntityRow) => [
  (pasture['foldGate'] as number) % w.map.width,
  Math.floor((pasture['foldGate'] as number) / w.map.width),
];

describe('herding', () => {
  it('shuts the flock in before dusk and lets it out after dawn', () => {
    const { w, flock, pasture } = pastureWorld();
    const a = herder(w);
    addKept(w, flock, ['ewe', 'ewe', 'ram'], a.id);
    const [gx, gy] = gate(w, pasture);
    stand(w, a, gx!, gy!);
    clock(w, 1, 8, 17, 50);
    step(w, sim, 40);
    expect(flock['folded']).toBe(1);
    expect(flock['outLine']).toBe(0);
    expect(lines(w, 'flock.leftOut')).toHaveLength(0);
    clock(w, 1, 9, 6, 0);
    step(w, sim, 45);
    expect(flock['folded']).toBe(0);
  });

  it('leaves the flock out, saying why, when the best herder is abed', () => {
    const { w, flock, pasture } = pastureWorld();
    const a = herder(w);
    addKept(w, flock, ['ewe', 'ewe', 'ram'], a.id);
    for (const p of w.entities['person']!) {
      const [gx, gy] = gate(w, pasture);
      stand(w, p, gx!, gy!);
      const rest = w.entities['need']!.find((n) => n['person'] === p.id && n['need'] === 'rest');
      rest!['value'] = 1;
    }
    // From an hour before dusk (the pack's `night.from`), past it.
    clock(w, 1, 8, content.wild.pack.night.from - 1, 0);
    step(w, sim, 70);
    expect(flock['folded']).toBe(0);
    const out = lines(w, 'flock.leftOut');
    expect(out).toHaveLength(1);
    expect(out[0]!.actors).toEqual([a.id]);
    expect(out[0]!.data['why']).toBe(`${a['name'] as string} was abed`);
  });

  it('butchers a marked animal, and whoever tamed it remembers', () => {
    const { w, flock } = pastureWorld();
    const a = herder(w);
    addKept(w, flock, ['ewe', 'ewe', 'ewe', 'ewe', 'ram'], a.id);
    flock['hay'] = 224;
    clock(w, 7, 1, 0, 0);
    flockSystem.run!(ctxOf(w));
    const victims = marked(w, flock).length;
    expect(victims).toBeGreaterThan(0);
    const victim = marked(w, flock)[0]!;
    stand(w, a, victim['x'] as number, victim['y'] as number);
    clock(w, 7, 1, 8, 0);
    step(w, sim, 240);
    expect(marked(w, flock).length).toBeLessThan(victims);
    const done = lines(w, 'flock.butchered');
    expect(done.length).toBeGreaterThan(0);
    expect(itemsOf(w).some((i) => i['kind'] === 'meat' && i['made'] === done[0]!.id)).toBe(true);
    const held = memoriesOf(w, a.id).filter((m) => m['memory'] === content.flock.memories.cull);
    expect(held.length).toBeGreaterThan(0);
  });

  it('tames a wild sheep in Bloommonth into the flock as a lamb', () => {
    const { w, flock } = pastureWorld();
    const a = herder(w);
    const herd = tameTargets(w, content, flock)[0]!;
    const sheep = animalsOf(w).find((s) => s['herd'] === herd.id)!;
    stand(w, a, (sheep['x'] as number) + 12, sheep['y'] as number);
    clock(w, 2, 3, 8, 0);
    step(w, sim, content.flock.tame.youngMinutes + 400);
    const kept = keptOf(w, flock);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept[0]).toMatchObject({ kind: 'lamb', young: 1, tamedBy: a.id });
    expect(lines(w, 'flock.tamed').length).toBe(headOf(w, flock));
    expect(herdsOf(w).some((h) => h['kept'] === flock['pasture'])).toBe(true);
  });

  it('carries dried hay to the rick and mows on a mowing day', () => {
    const { w, flock, pasture } = pastureWorld();
    const a = herder(w);
    const meadow = (pasture['my'] as number) * w.map.width + (pasture['mx'] as number) + 2;
    Object.assign(flock, { swaths: [meadow], swathHay: [16], swathDry: [content.flock.hay.dry] });
    stand(w, a, (pasture['mx'] as number) + 2, pasture['my'] as number);
    clock(w, 3, 3, 8, 0);
    flock['mowDay'] = Math.floor(w.tick / DAY);
    step(w, sim, 150);
    expect(flock['hay']).toBe(16);
    expect(flock['swaths']).not.toContain(meadow);
    expect((flock['mown'] as number[]).length).toBeGreaterThan(0);
    expect(lines(w, 'flock.mowing')).toHaveLength(1);
  });
});
