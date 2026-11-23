// 6W review fixes (V-224): a walked rock face is fresh again a year on, or at once for a better
// miner; an ore wanted and not found is told of once a season; a shaft far out is gone to with a
// pack and sunk; a plan held two days with nothing sunk goes to the next free miner; a plan not
// begun in a season says why. Nobody is sent (V-041): every check here only reads lines.
import { describe, expect, it } from 'vitest';
import { content as game, type Content } from '../../content/index.ts';
import { withoutAccidents } from '../health/index.ts';
import { allLines, createSim, createWorld, step, submitCommand, whyOf } from '../index.ts';
import { plantSeam, shaftsOf } from '../mine/index.ts';
import { able, people } from '../band/index.ts';

const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const base = withoutAccidents(game);
const YEAR = game.calendar.daysPerMonth * game.calendar.monthsPerYear * DAY;
const SEASON = YEAR / game.calendar.seasons.length;

const lines = (w: World, type: string) => allLines(w).filter((l) => l.type === type);
const withMine = (mine: Partial<Content['work']['mine']>): Content => ({
  ...base,
  work: { ...base.work, mine: { ...base.work.mine, ...mine } },
});

/** A colony that wants iron, the whole valley known. */
function wantsIron(content: Content, seed: string): World {
  const w = createWorld(createSim(content), seed);
  w.map.known.fill(1);
  submitCommand(w, {
    tick: w.tick + 1,
    kind: 'setStock',
    data: { good: 'iron-ingot', level: 'some' },
  });
  return w;
}

/** Every face walked at `at` by a miner of level `skill`. */
function walkAll(w: World, at: number, skill: number): void {
  const walks = (w.systems['faces'] ??= {});
  w.map.faces.forEach((v, i) => {
    if (!v) return;
    w.map.faces[i] = v | 128;
    walks[i] = at * 16 + skill;
  });
}

const MINING = game.jobs.find((j) => j.id === game.work.mine.job)!.skill!;
const bestMining = (w: World): number =>
  Math.max(
    0,
    ...(w.entities['skill'] ?? [])
      .filter((s) => s['skill'] === MINING)
      .map((s) => s['level'] as number),
  );

describe('ore wanted and not found', () => {
  it('walks the faces again a year on, or at once for a better miner, not for an equal one', () => {
    const sim = createSim(base);
    const fresh = wantsIron(base, 'smoke');
    walkAll(fresh, fresh.tick, 15);
    step(fresh, sim, 3 * DAY);
    expect(lines(fresh, 'work.tookUpProspecting')).toHaveLength(0);
    const aged = wantsIron(base, 'smoke');
    walkAll(aged, aged.tick - YEAR, 15);
    step(aged, sim, 3 * DAY);
    expect(lines(aged, 'work.tookUpProspecting').length).toBeGreaterThan(0);
    const best = bestMining(aged);
    if (best > 0) {
      const lesser = wantsIron(base, 'smoke');
      walkAll(lesser, lesser.tick, best - 1);
      step(lesser, sim, 3 * DAY);
      expect(lines(lesser, 'work.tookUpProspecting').length).toBeGreaterThan(0);
    }
  });

  it('says once a season that the ore is still wanted, citing the want', () => {
    const sim = createSim(base);
    const w = wantsIron(base, 'smoke');
    walkAll(w, w.tick, 15);
    step(w, sim, DAY);
    expect(w.systems['orewant']?.['iron']).toBeDefined();
    // The want began a season ago: the next day's start says so, once.
    const since = w.systems['orewant']!;
    since['iron'] = since['iron']! - SEASON;
    step(w, sim, 2 * DAY);
    const said = lines(w, 'land.stillNoOre').filter((l) => l.data['metal'] === 'iron');
    expect(said).toHaveLength(1);
    expect(said[0]!.data['why']).toMatch(/^the tools are |^nobody has a tool$/);
    expect(whyOf(w, said[0]!.id).map((c) => c.event.type)).toContain('goods.stockSet');
  });
});

describe('a far shaft (V-224)', () => {
  /** `seed` with two iron seams planted, run until someone takes up sinking. */
  function untilSinking(content: Content, seed = 'smoke') {
    const sim = createSim(content);
    const w = wantsIron(content, seed);
    plantSeam(w, content, 'iron');
    plantSeam(w, content, 'iron');
    const sinker = () =>
      (w.entities['person'] ?? []).find((q) => q['job'] === 'mine' && q['task'] === 'sink');
    for (let m = 0; m < 8 * DAY && !sinker(); m += 10) step(w, sim, 10);
    return { sim, w, sinker: sinker()! };
  }

  it('is gone to with a pack and sunk', () => {
    const { sim, w, sinker } = untilSinking(withMine({ pack: 0 }));
    expect(sinker['packed']).toBe(1);
    for (let m = 0; m < 8 * DAY && !lines(w, 'mine.sank').length; m += 10) step(w, sim, 10);
    expect(lines(w, 'mine.sank')[0]?.actors).toEqual([sinker.id]);
  });

  it('goes to the next free miner when held two days with nothing sunk', () => {
    // A valley where more than one is able to mine (smoke has one).
    const seed = ['anvil', 'tallow', 'ledger-1'].find(
      (k) =>
        people(createWorld(createSim(base), k)).filter((q) => able(base, q, 'mine')).length > 1,
    )!;
    const { sim, w, sinker } = untilSinking(base, seed);
    const shaft = shaftsOf(w)[0]!;
    const holds = w.systems['minefar']!;
    holds[`t${shaft.id}`] = w.tick - 3 * DAY;
    holds[`f${shaft.id}`] = w.tick - 3 * DAY;
    for (let m = 0; m < DAY && sinker['task'] === 'sink'; m += 1) step(w, sim, 1);
    expect(sinker['task']).not.toBe('sink');
    // The player raises Mining for the rest of the band (a lever on the Work sheet, V-041).
    for (const q of w.entities['person'] ?? [])
      if (q.id !== sinker.id)
        submitCommand(w, {
          tick: w.tick + 1,
          kind: 'setPriority',
          data: { person: q.id, job: base.work.mine.job, level: 1 },
        });
    const before = lines(w, 'work.tookUp').length;
    for (let m = 0; m < 2 * DAY; m += 10) step(w, sim, 10);
    const next = lines(w, 'work.tookUp')
      .slice(before)
      .filter((l) => l.data['work'] === base.work.mine.words.sink);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every((l) => !l.actors.includes(sinker.id))).toBe(true);
  });

  it('says once a season why a plan is not begun', () => {
    const content = withMine({ ladder: { logs: 100000 } });
    const sim = createSim(content);
    const w = wantsIron(content, 'tallow');
    plantSeam(w, content, 'iron');
    step(w, sim, 2 * DAY);
    const shaft = shaftsOf(w)[0]!;
    w.systems['minefar']![`f${shaft.id}`] = w.tick - SEASON;
    step(w, sim, 2 * DAY);
    const said = lines(w, 'mine.shaftWaits');
    expect(said).toHaveLength(1);
    expect(said[0]!.data['why']).toBe('fewer than 100000 logs can be reached for its ladder');
    expect(said[0]!.causes).toContain(shaft['line']);
  });
});
