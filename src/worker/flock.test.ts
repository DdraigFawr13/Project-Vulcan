// The flock and its pasture on the page (Phase 5 Bundle 3): the Build sheet's Pasture row, the
// Herding row's visibility, the pasture, fold, meadow and rick pages, a kept animal's page, the
// map's meadow and rick frames and the Stock sheet's flock plate. Pasture and flock rows are made
// directly, so this holds whatever the siting rules choose.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  addEntity,
  createSim,
  createWorld,
  foldTiles,
  hurdleTiles,
  meadowTiles,
  type WorldState,
} from '../engine/index.ts';
import { buildView } from './build.ts';
import { flockPlate, pastureFrames, pastureRow } from './flock.ts';
import { goodsOf } from './goods.ts';
import { jobShown } from './jobrows.ts';
import { tileView } from './views.ts';
import { animalPage, leftoversView } from './wild.ts';

const sim = createSim(content);
const nobody = () => ({ text: '' }) as never;
const at = (w: WorldState, i: number) =>
  tileView(w, i % w.map.width, Math.floor(i / w.map.width), 0, nobody)!;

/** A world with a pasture planned or built beside the green and, if built, an empty flock row. */
function pastureWorld(state: 'plan' | 'built') {
  const w = createWorld(sim, 'anvil/1');
  const { map } = w;
  const [x, y] = [map.startX + 14, map.startY + 14];
  const pasture = addEntity(w, 'pasture', {
    ...{ x, y, w: 11, h: 10, corner: 'sw', fold: 4, gate: y * map.width + x + 5, foldGate: 0 },
    ...{ mx: x + 12, my: y, mw: 12, mh: 7, rick: (y + 8) * map.width + x + 12 },
    ...{
      state,
      line: w.begunEvent,
      last: w.begunEvent,
      why: 'open grass by the stream',
      sent: 0,
      at: 0,
    },
  });
  const p = w.entities['pasture']!.find((r) => r.id === pasture)!;
  if (state === 'plan') return { w, p, flock: undefined };
  const id = addEntity(w, 'flock', {
    ...{ pasture, hay: 0, swaths: [], swathHay: [], swathDry: [], mown: [], mowDay: 0, mowLog: 0 },
    ...{ spoiled: 0, folded: 0, outLine: 0, takenAt: 0, takenLine: 0, onHay: 0, cullLine: 0 },
    ...{ full: 0, line: w.begunEvent, year: 0, births: [] },
  });
  return { w, p, flock: w.entities['flock']!.find((r) => r.id === id)! };
}

/** Puts kept animals of the first species in the flock's herd. */
function keep(w: WorldState, pasture: number, rows: [kind: string, young: number, by?: number][]) {
  const herd = addEntity(w, 'herd', {
    ...{ species: 'sheep', x: 0, y: 0, radius: 0, start: 0, line: w.begunEvent, kept: pasture },
    ...{ taken: 0, lost: 0, byPack: 0, bySnow: 0, low: 0 },
  });
  return rows.map(([kind, young, by]) =>
    addEntity(w, 'animal', {
      ...{
        herd,
        pack: 0,
        kind,
        x: 1,
        y: 1,
        z: 0,
        path: [],
        stride: 0,
        facing: 'e',
        state: '',
        until: 0,
      },
      ...{ sex: kind === 'ram' ? 'm' : 'f', born: young ? w.tick : 0, young, tamedBy: by ?? 0 },
      ...{ cull: 0, shorn: 0, dies: 0 },
    }),
  );
}

describe('the Pasture row', () => {
  it('shows while wild sheep graze or a pasture exists, at the level set', () => {
    const { w } = pastureWorld('plan');
    w.entities['pasture'] = [];
    const wild = pastureRow(w);
    expect(pastureRow(w)?.want).toEqual({ level: content.flock.pasture.start, word: 'third' });
    addEntity(w, 'want', { kind: 'pasture', level: 2, line: w.begunEvent });
    expect(pastureRow(w)?.want).toEqual({ level: 2, word: 'second' });
    expect(wild?.need).toMatch(
      /^a pasture for 12 head\. .+ graze (north|south|east|west).* of the green, and the colony keeps no flock$/,
    );
    expect(wild?.plan).toBeUndefined();
    w.entities['herd'] = [];
    expect(pastureRow(w)).toBeUndefined();
    expect(buildView(w).pasture).toBeUndefined();
  });

  it('words a plan with its reason and Send back until a hurdle stands', () => {
    const { w, p } = pastureWorld('plan');
    const plan = buildView(w).pasture!.plan!;
    expect(plan.words).toMatch(
      /^72 tiles of grass with a fold in its corner and a 84-tile hay meadow beside it, .+ of the green: planned\. Hurdles: 0 of \d+ up\.$/,
    );
    expect(plan).toMatchObject({
      state: 'plan',
      why: 'open grass by the stream',
      back: true,
      sent: false,
    });
    const tile = hurdleTiles(content, w.map.width, p)[0]!.i;
    addEntity(w, 'plan', {
      ...{ part: 'hurdle', x: tile % w.map.width, y: Math.floor(tile / w.map.width), z: 0 },
      ...{
        have: 1,
        also: 0,
        work: 0,
        state: 'built',
        line: 0,
        done: 0,
        waited: 0,
        shut: 0,
        held: 0,
        house: 0,
      },
    });
    const after = pastureRow(w)!.plan!;
    expect(after.words).toMatch(/Hurdles: 1 of \d+ up\.$/);
    expect(after.back).toBe(false);
    p['sent'] = 1;
    expect(pastureRow(w)!.plan!.sent).toBe(true);
  });

  it('holds the Herding row back until a pasture is live', () => {
    const { w, p } = pastureWorld('plan');
    expect(jobShown(w, 'herd')).toBe(true);
    p['state'] = 'sent';
    expect(jobShown(w, 'herd')).toBe(false);
    expect(jobShown(w, 'farm')).toBe(true);
  });
});

describe('the pasture pages', () => {
  it('opens the pasture, fold, meadow and rick pages, read-only, and none on a hurdle', () => {
    const { w, p, flock } = pastureWorld('built');
    keep(w, p.id, [
      ['ram', 0],
      ['ewe', 0],
      ['ewe', 0],
      ['lamb', 1],
    ]);
    flock!['hay'] = 840;
    const grazing = at(w, ((p['y'] as number) + 3) * w.map.width + (p['x'] as number) + 8);
    expect(grazing.pasture?.title).toBe('Pasture');
    const rows = Object.fromEntries(grazing.pasture!.rows);
    expect(rows['Flock']).toBe('4 sheep: 1 ram, 2 ewes, 1 lamb');
    expect(rows['Holds']).toBe('12 head on its grass');
    expect(rows['Hay in the rick']).toBe('840 in the rick, enough for 4 for 210 days');
    expect(rows['Herders']).toMatch(/^by Herding priority, third: /);
    const fold = at(w, foldTiles(w.map.width, p)[0]!).pasture!;
    expect(fold.title).toBe('Fold');
    flock!['onHay'] = 1;
    expect(
      Object.fromEntries(at(w, foldTiles(w.map.width, p)[0]!).pasture!.rows)['Hay in the rick'],
    ).toMatch(/210 days; Thawmonth's grass is \d+ days off$/);
    expect(at(w, meadowTiles(w.map.width, p)[0]!).pasture?.title).toBe('Hay meadow');
    expect(at(w, p['rick'] as number).pasture?.title).toBe('Hay rick');
    expect(at(w, hurdleTiles(content, w.map.width, p)[0]!.i).pasture).toBeUndefined();
    expect(at(w, 0).pasture).toBeUndefined();
  });

  it('opens a kept animal flock page with its kind word, age, tamer and cull mark', () => {
    const { w, p } = pastureWorld('built');
    const tamer = w.entities['person']![0]!;
    const [ewe, lamb] = keep(w, p.id, [
      ['ewe', 0, tamer.id],
      ['lamb', 1],
    ]);
    w.entities['animal']!.find((a) => a.id === ewe)!['cull'] = w.tick + 1;
    const page = animalPage(w, ewe!, nobody)!;
    expect(page.title).toBe('Ewe');
    expect(page.who).toMatch(/^A grown ewe of the pasture's flock/);
    const rows = Object.fromEntries(page.rows);
    expect(rows['Tamed by']).toBe(tamer['name']);
    expect(rows['Marked to cull']).toMatch(/^yes/);
    const young = Object.fromEntries(animalPage(w, lamb!, nobody)!.rows);
    expect(young['Kind']).toBe('lamb, young');
    expect(young['Tamed by']).toBe('born in the flock');
    expect(young['Marked to cull']).toBe('no');
  });
});

describe('the flock on the map and the Stock sheet', () => {
  it('draws the meadow by what each tile is, and the rick in thirds', () => {
    const { w, p, flock } = pastureWorld('built');
    const tiles = meadowTiles(w.map.width, p);
    const [swath, cocks, stubble] = [tiles[0]!, tiles[1]!, tiles[2]!];
    Object.assign(flock!, {
      swaths: [swath, cocks],
      swathHay: [16, 16],
      swathDry: [1, content.flock.hay.dry],
      mown: [swath, cocks, stubble],
    });
    const frames = (): Record<string, number[]> =>
      Object.fromEntries(pastureFrames(w).map((f) => [f.frame, f.tiles]));
    expect(frames()['pasture.swath']).toEqual([swath]);
    expect(frames()['pasture.cocks']).toEqual([cocks]);
    expect(frames()['pasture.stubble']).toEqual([stubble]);
    expect(frames()['pasture.meadow']).toHaveLength(tiles.length - 3);
    expect(Object.keys(frames()).some((k) => k.startsWith('pasture.rick'))).toBe(false);
    const full = content.flock.pasture.holds * content.flock.hay.plan;
    for (const [hay, third] of [
      [1, 1],
      [full / 3, 1],
      [full / 2, 2],
      [full, 3],
    ] as const) {
      flock!['hay'] = hay;
      expect(frames()[`pasture.rick.${third}`]).toEqual([p['rick']]);
    }
    expect(goodsOf(w).fields.some((f) => f.frame === 'pasture.rick.3')).toBe(true);
  });

  it('shows the flock plate and fleece once a flock stands, and nothing before', () => {
    const w0 = createWorld(sim, 'anvil/1');
    expect(flockPlate(w0)).toBeUndefined();
    expect(leftoversView(w0).items.map((i) => i.item)).toEqual(['hide', 'bone', 'fat']);
    const { w, p, flock } = pastureWorld('built');
    keep(w, p.id, [
      ['ram', 0],
      ['ewe', 0],
      ['ewe', 0],
    ]);
    flock!['hay'] = 300;
    const view = leftoversView(w);
    expect(view.items.map((i) => i.item)).toEqual(['fleece', 'hide', 'bone', 'fat']);
    expect(view.flock).toEqual({
      head: [['Sheep', '3 kept (1 ram, 2 ewes)']],
      hay: '300 in the rick, enough for 3 for 100 days',
    });
  });
});
