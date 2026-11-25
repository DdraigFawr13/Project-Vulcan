// 6W Slice 5 part 2 (V-206): finds laid on the map and found by whoever sees them, each a line
// and a tale; curios far out, one a season for the colony (V-233); a scout to see what lies beyond when nothing
// new has been found; a newcomer's word that steers the next scout for that good.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { withoutAccidents } from '../health/index.ts';
import { allLines, createSim, createWorld, step, submitCommand } from '../index.ts';
import { storeOf } from '../goods/index.ts';

const calmContent = withoutAccidents(content);
const HOUR = 60;
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const cheb = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const people = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

describe('finds', () => {
  it('lays each kind of find away from the green, a clay bank as clay by a river', () => {
    const sim = createSim(content);
    const kinds = new Set<string>();
    for (const seed of ['anvil', 'smoke', 'tallow', 'ledger-1']) {
      const w = createWorld(sim, seed);
      const m = w.map;
      for (const p of m.places) {
        kinds.add(p.kind);
        expect(cheb(p.x, p.y, m.startX, m.startY)).toBeGreaterThanOrEqual(
          content.work.scout.places.from,
        );
        expect(p.line).toBe(0);
      }
      for (const p of m.places.filter((q) => q.kind === 'clay')) {
        let clay = 0;
        for (let y = p.y - 2; y <= p.y + 2; y += 1)
          for (let x = p.x - 2; x <= p.x + 2; x += 1)
            if (content.terrain.kinds[m.tiles[y * m.width + x]!]!.id === 'clay') clay += 1;
        expect(clay).toBeGreaterThanOrEqual(5);
      }
    }
    // Seams are not laid: they are spotted in rock faces (V-215).
    const laid = content.work.scout.places.kinds.filter((k) => k.rule !== 'seam');
    expect([...kinds].sort()).toEqual(laid.map((k) => k.id).sort());
  });

  it('a find seen is found by whoever is nearest, a line and a tale', () => {
    const sim = createSim(calmContent);
    const w = createWorld(sim, 'anvil');
    step(w, sim, HOUR);
    const place = w.map.places.find((p) => p.kind === 'spring')!;
    // Someone stands beside it, so they see it.
    const p = people(w)[0]!;
    Object.assign(p, { x: place.x + 1, y: place.y, path: [] });
    w.map.known[place.y * w.map.width + place.x] = 1;
    step(w, sim, 20);
    const [found] = lines(w, 'land.found');
    expect(found).toBeDefined();
    expect(found!.actors).toEqual([p.id]);
    expect(found!.data['what']).toBe('a spring');
    expect(place.line).toBe(found!.id);
    step(w, sim, 5);
    const story = (w.entities['story'] ?? []).find((s) => s['event'] === found!.id);
    expect(story?.['tale']).toBe('found-place');
  });

  it('anyone far out may come on a curio, at most one a season for the whole colony', () => {
    const def = calmContent.work.scout;
    const run = createSim({
      ...calmContent,
      work: { ...calmContent.work, scout: { ...def, curio: { ...def.curio, far: 0, per: 1 } } },
    });
    const w = createWorld(run, 'tallow');
    // Everyone is out past the green and each hour is sure to bring one: one comes, and no more.
    step(w, run, 6 * HOUR);
    const got = lines(w, 'land.curio');
    expect(got).toHaveLength(1);
    const mem = (w.entities['memory'] ?? []).filter((m) =>
      ['wonder', 'unease'].includes(m['memory'] as string),
    );
    const leave = got.filter((e) => def.curio.list.find((c) => c.id === e.data['curio'])?.memory);
    expect(mem.length).toBe(leave.length);
  });

  it('with nothing new found for a while, a scout goes to see what lies beyond', () => {
    const def = calmContent.work.scout;
    const run = createSim({
      ...calmContent,
      work: { ...calmContent.work, scout: { ...def, beyond: { ...def.beyond, days: 1 } } },
    });
    const w = createWorld(run, 'anvil');
    // Every rock face walked, so no ore want sends a prospector first (V-215).
    w.map.faces.forEach((v, i) => v && (w.map.faces[i] = v | 128));
    for (let t = 0; t < 6 * DAY && !lines(w, 'land.beyond').length; t += 30) step(w, run, 30);
    const [out] = lines(w, 'work.tookUpScoutingBeyond');
    const [home] = lines(w, 'land.beyond');
    expect(out).toBeDefined();
    expect(home?.causes).toContain(out!.id);
    expect(home!.data['far']).toBeGreaterThan(content.work.scout.reach);
  });

  it('goes to see what lies beyond while an ore is wanted that nobody free can prospect for', () => {
    const def = calmContent.work.scout;
    const run = createSim({
      ...calmContent,
      work: { ...calmContent.work, scout: { ...def, beyond: { ...def.beyond, days: 1 } } },
    });
    const w = createWorld(run, 'anvil');
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'iron-ingot', level: 'some' },
    });
    // The best miner is below ground, and every face was walked today by a miner the rest cannot
    // better: the faces are fresh to that one alone (V-227), who cannot walk them from there.
    const [best, ...rest] = people(w);
    const mining = content.jobs.find((j) => j.id === content.work.mine.job)!.skill!;
    for (const s of w.entities['skill'] ?? [])
      if (s['skill'] === mining) s['level'] = s['person'] === best!.id ? 15 : 0;
    const walks = (w.systems['faces'] ??= {});
    w.map.faces.forEach((v, i) => v && ((w.map.faces[i] = v | 128), (walks[i] = w.tick * 16 + 10)));
    const below = () => Object.assign(best!, { z: 1, job: '', task: '', path: [] });
    for (let t = 0; t < 6 * DAY && !lines(w, 'land.beyond').length; t += 30) {
      below();
      step(w, run, 30);
    }
    expect(lines(w, 'work.tookUpProspecting')).toHaveLength(0);
    const [out] = lines(w, 'work.tookUpScoutingBeyond');
    expect(rest.map((p) => p.id)).toContain(out?.actors[0]);
    expect(lines(w, 'land.beyond')[0]?.causes).toContain(out!.id);
  });

  it('goes beyond the land within `far` once all of it has been seen', () => {
    const def = calmContent.work.scout;
    const run = createSim({
      ...calmContent,
      work: { ...calmContent.work, scout: { ...def, beyond: { ...def.beyond, days: 1 } } },
    });
    const w = createWorld(run, 'anvil');
    w.map.faces.forEach((v, i) => v && (w.map.faces[i] = v | 128));
    const s = storeOf(w)[0];
    const [ox, oy] = s ? [s['x'] as number, s['y'] as number] : [w.map.startX, w.map.startY];
    w.map.known.forEach((_, i) => {
      const near = cheb(i % w.map.width, Math.floor(i / w.map.width), ox, oy) <= def.far + 10;
      w.map.known[i] = near ? 1 : 0;
    });
    for (let t = 0; t < 6 * DAY && !lines(w, 'land.beyond').length; t += 30) step(w, run, 30);
    expect(lines(w, 'work.tookUpScoutingBeyond')).toHaveLength(1);
    expect(lines(w, 'land.beyond')).toHaveLength(1);
  });

  it('a newcomer tells of what they passed on the road in', () => {
    const sim = createSim(calmContent);
    const w = createWorld(sim, 'smoke');
    step(w, sim, HOUR);
    // One of the band stands in for someone come from the east and let stay.
    const came = allLines(w).at(-1)!.id;
    const p = people(w)[0]!;
    Object.assign(p, { stranger: came, arrived: came, homeDir: 'east' });
    step(w, sim, HOUR);
    const [word] = lines(w, 'land.word');
    expect(word).toBeDefined();
    expect(word!.actors).toEqual([p.id]);
    expect(word!.causes).toEqual([came]);
    expect(w.systems['word']!['good']).toBeGreaterThan(0);
    expect(w.systems['word']!['line']).toBe(word!.id);
    // Told once only.
    step(w, sim, 2 * HOUR);
    expect(lines(w, 'land.word')).toHaveLength(1);
  });

  it("a newcomer's word pulls the next scout for that good its way", () => {
    const def = calmContent.work.scout;
    const run = createSim({
      ...calmContent,
      work: { ...calmContent.work, scout: { ...def, word: { ...def.word, lean: 500 } } },
    });
    const w = createWorld(run, 'anvil');
    const s = storeOf(w)[0]!;
    const [ox, oy] = [s['x'] as number, s['y'] as number];
    const reach = content.work.fell.reach;
    for (let i = 0; i < w.map.features.length; i += 1) {
      const f = w.map.features[i]!;
      const kind = f ? content.features[f - 1]!.kind : '';
      const [x, y] = [i % w.map.width, Math.floor(i / w.map.width)];
      if (cheb(x, y, ox, oy) <= reach && ['tree', 'log'].includes(kind)) w.map.features[i] = 0;
    }
    // The word: a wood to the south-west, whatever the land says.
    const said = allLines(w).at(-1)!.id;
    w.systems['word'] = { seen: 1e9, good: 1, dx: -1, dy: 1, line: said };
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'logs', level: 'plenty' },
    });
    for (let t = 0; t < 3 * DAY && !lines(w, 'work.tookUpScouting').length; t += 10)
      step(w, run, 10);
    const [out] = lines(w, 'work.tookUpScouting');
    expect(out?.causes).toContain(said);
    const trip = w.map.finds.at(-1)!;
    expect(trip.x).toBeLessThan(ox);
    expect(trip.y).toBeGreaterThan(oy);
    expect(w.systems['word']!['good']).toBe(0);
  });
});
