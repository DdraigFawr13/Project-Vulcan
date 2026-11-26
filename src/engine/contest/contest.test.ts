// 6C Slice 7 part 3 (V-236, V-241): contests at the harvest home. The supper eaten, the grown-ups
// stand up for a contest by their traits; the winner is proud and the rest sour; a third win gives
// a byname and a second beating by the same winner makes a rival; with the lord at the supper the
// contest held for him pleases a bold lord and its winner takes his prize.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import type { Content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  emit,
  step,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  today,
  withoutAccidents,
  yearNow,
} from '../index.ts';
import { lordRow, reeveRow } from '../lord/index.ts';
import { bynameOf } from '../tales/index.ts';
import { contestsOf } from './index.ts';

type World = ReturnType<typeof createWorld>;
type Sim = ReturnType<typeof createSim>;
const SEED = 'smoke/1';
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const living = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Everyone stands up for the trial of strength, and the strongest always wins it. */
const sure = (c: Content): Content => {
  const x = structuredClone(c);
  Object.assign(x.contests, { roll: 0, kinds: x.contests.kinds.filter((k) => k.id === 'arm') });
  Object.assign(x.contests.enter, { base: 100 });
  return x;
};

/** A harvest-home supper eaten just now by everyone living (or brought in to be called tonight). */
function harvestHome(w: World, sim: Sim, eaten: boolean): number {
  const home = emit(w, sim.templates, 'farm.harvestHome', {
    causes: [w.begunEvent],
    data: { names: 'the band', crop: 'turnips', count: 2000, what: 'turnips' },
  });
  addEntity(w, 'feast', {
    ...{ line: home, year: yearNow(w, content), state: eaten ? 'eaten' : 'called', start: 0 },
    ...{ there: eaten ? living(w).map((p) => p.id) : [], eaten: eaten ? home : 0, couple: [] },
    ...{ on: today(w), holy: 0, lean: 0 },
  });
  return home;
}

describe('contests at the harvest home', () => {
  const sim = createSim(withoutAccidents(sure(content)));

  it('holds one once the supper is eaten: the winner proud, the rest sour', () => {
    const w = createWorld(sim, SEED);
    step(w, sim, TICKS_PER_HOUR);
    const home = harvestHome(w, sim, true);
    step(w, sim, 2);
    const [held] = lines(w, 'contest.held');
    expect(held!.causes).toContain(home);
    const strongest = [...living(w)].sort(
      (a, b) => (b['strength'] as number) - (a['strength'] as number) || a.id - b.id,
    )[0]!;
    expect(held!.actors[0]).toBe(strongest.id);
    expect(held!.actors).toHaveLength(living(w).length);
    const mem = (id: string) =>
      (w.entities['memory'] ?? []).filter((m) => m['memory'] === id && m['line'] === held!.id);
    expect(mem('contest-won').map((m) => m['person'])).toEqual([strongest.id]);
    expect(mem('contest-lost')).toHaveLength(living(w).length - 1);
    // Held once a supper, and not for a supper called but not yet eaten.
    harvestHome(w, sim, false);
    step(w, sim, 10);
    expect(lines(w, 'contest.held')).toHaveLength(1);
  });

  it('makes rivals of the twice beaten, and names the winner on the third win', () => {
    const w = createWorld(sim, SEED);
    step(w, sim, TICKS_PER_HOUR);
    for (let k = 0; k < 3; k += 1) {
      harvestHome(w, sim, true);
      step(w, sim, TICKS_PER_DAY);
    }
    const winner = contestsOf(w)[0]!['winner'] as number;
    expect(contestsOf(w).map((c) => c['winner'])).toEqual([winner, winner, winner]);
    const rival = lines(w, 'contest.rival');
    expect(rival).toHaveLength(living(w).length - 1);
    expect(rival.every((e) => e.actors[1] === winner)).toBe(true);
    expect(rival[0]!.causes).toEqual([contestsOf(w)[1]!['line']]);
    const named = lines(w, 'tale.byname').find((e) => e.actors[0] === winner);
    expect(named!.causes).toEqual([contestsOf(w)[2]!['line']]);
    expect(['Strongarm', 'Oak-arm', 'Ox-back']).toContain(bynameOf(w, winner)!['word']);
  });

  it('pleases a bold lord at his supper, and its winner takes his prize', () => {
    const w = createWorld(sim, SEED);
    step(w, sim, TICKS_PER_HOUR);
    harvestHome(w, sim, true);
    for (let h = 0; h < 48 && !lordRow(w); h += 1) step(w, sim, TICKS_PER_HOUR);
    while (reeveRow(w)) step(w, sim, TICKS_PER_HOUR);
    lordRow(w)!['visits'] = 1;
    lordRow(w)!['temper'] = 'bold';
    step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) + TICKS_PER_HOUR);
    harvestHome(w, sim, false);
    for (let h = 0; h < 48 && !lines(w, 'lord.rodeOut').length; h += 1)
      step(w, sim, TICKS_PER_HOUR);
    const his = contestsOf(w).find((c) => c['lord'])!;
    expect(his).toBeDefined();
    const pleased = lines(w, 'lord.favour').find((e) => e.data['cause'] === 'pleased');
    expect(pleased).toBeDefined();
    const [prize] = lines(w, 'lord.prize');
    expect(prize!.actors).toEqual([his['winner']]);
    expect(prize!.causes).toContain(his['line']);
    const tool = (w.entities['item'] ?? []).find((i) => i['made'] === prize!.id)!;
    expect(tool['owner']).toBe(his['winner']);
  });
});
