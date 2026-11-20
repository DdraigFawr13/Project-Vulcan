// 6A review P2 and P4 (V-176, V-178): hard times speak without a law, and a leaver takes only the
// housemates who share the grievance. An empty store while someone goes hungry lowers standing at
// any law; someone who went hungry and believes the valley cannot feed them takes from a store
// that will not last, even at full plates, and the line cites that memory and belief.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  bedOwnedBy,
  createSim,
  createWorld,
  defySystem,
  findEvent,
  homeHouse,
  inStore,
  isWinter,
  pilfer,
  standingOf,
  step,
  storeLasts,
  submitCommand,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  type EntityRow,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { leave } from './leave.ts';
import { grievanceOf, reasonsOf } from './why.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const food = new Set(content.items.filter((i) => i.good === 'food').map((i) => i.id));
const { starving } = content.defy;

/** Takes every bit of food out of the valley. */
const strip = (w: World) => {
  w.entities['item'] = (w.entities['item'] ?? []).filter((i) => !food.has(i['kind'] as string));
};

/** Gives `p` memory `memory` (as from line `line`). */
function remember(w: World, p: EntityRow, memory: string, line: number): void {
  addEntity(w, 'memory', {
    ...{ person: p.id, memory, until: w.tick + 4 * TICKS_PER_DAY, line, about: 0 },
    ...{ weight: 1, since: w.tick, first: 0, last: 0, days: 1, mask: 1, fresh: 1 },
  });
}

describe('hard times without a law (P2)', () => {
  it('lowers standing when the store runs out while someone goes hungry', () => {
    const w = createWorld(sim, 'smoke');
    const out = content.colony.standing.storeOut;
    const before = standingOf(w, content);
    const at = content.colony.hour * TICKS_PER_HOUR;
    // Each day just before the colony's reckoning: the store bare, someone gone to bed hungry.
    for (let d = 0; d < out.every + 1; d++) {
      step(
        w,
        sim,
        (at - 1 - (w.tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY || TICKS_PER_DAY,
      );
      strip(w);
      remember(w, alive(w)[0]!, out.hungry, 0);
      step(w, sim, 2);
    }
    const line = allLines(w).find((e) => e.data['cause'] === 'storeOut');
    expect(line?.data['text']).toBe('The store ran out');
    expect(standingOf(w, content)).toBe(before + out.by);
  });

  it('lets someone starving who believes the valley cannot feed them take, at full plates', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 3 * TICKS_PER_DAY);
    const stack = (w.entities['item'] ?? []).find(
      (i) =>
        food.has(i['kind'] as string) &&
        !i['holder'] &&
        !content.life.lastResort.includes(i['kind'] as string) &&
        inStore(w, i['x'] as number, i['y'] as number, i['z'] as number),
    )!;
    expect(stack).toBeDefined();
    // Leave one stack of a few: a store that will not last to the harvest.
    w.entities['item'] = (w.entities['item'] ?? []).filter(
      (i) => i === stack || !food.has(i['kind'] as string),
    );
    stack['count'] = 6;
    expect(storeLasts(w, content, 0)).toBe(false);
    const p = alive(w)[0]!;
    const ctx = contextFor(w, sim, defySystem);
    pilfer(ctx, p, stack);
    // Fed and without the belief, nobody takes.
    expect(allLines(w).some((e) => e.type === 'defy.took')).toBe(false);
    const said = allLines(w).at(-1)!.id;
    remember(w, p, starving.memory, said);
    addEntity(w, 'belief', {
      person: p.id,
      belief: starving.belief,
      strength: 2,
      line: said,
      fed: w.tick,
    });
    pilfer(ctx, p, stack);
    const took = allLines(w).find((e) => e.type === 'defy.took');
    expect(took?.actors).toEqual([p.id]);
    expect(took?.data['why']).toMatch(/went to bed hungry; .*this valley cannot feed us/);
    expect(took?.causes).toEqual([said]);
  });
});

type Hard = { w: World; p: EntityRow; shares: EntityRow; doubts: EntityRow };

/** Where `q` sleeps: their bed, else their laid bedroll. */
const bedOf = (w: World, q: EntityRow) =>
  bedOwnedBy(w, q.id) ??
  (w.entities['item'] ?? []).find(
    (i) => i['owner'] === q.id && i['kind'] === content.life.cart.bedroll && i['state'] === 'laid',
  );

/** A hard winter under Hunger rations, and a house of three where one holds the memory and
 * belief behind their grievance. Who shares a house and who went hungry that winter are the
 * seed's history (6B roofs moved anvil's), so the house is made: two others with the same
 * grievance sleep where `p` sleeps, and the second is given `p`'s memory and belief. A third is
 * made to doubt it in the test. */
function hardWinter(): Hard {
  for (const seed of ['anvil', 'smoke', 'tallow', 'ledger-1']) {
    const found = hardWinterOn(seed);
    if (found) return found;
  }
  throw new Error('no seed has a grievance held from memory and belief at home');
}

function hardWinterOn(seed: string): Hard | undefined {
  const w = createWorld(sim, seed);
  let day = 0;
  while (!isWinter({ ...w, tick: day * TICKS_PER_DAY }, content)) day += 1;
  w.tick = day * TICKS_PER_DAY + 6 * TICKS_PER_HOUR;
  step(w, sim, 60);
  submitCommand(w, {
    tick: w.tick + 1,
    kind: 'setLaw',
    data: { law: 'rations', setting: 'hunger' },
  });
  for (let d = 0; d < 30; d++) step(w, sim, TICKS_PER_DAY);
  const why = (q: EntityRow) => {
    const g = grievanceOf(w, content, q.id);
    return g ? reasonsOf(w, content, q.id, g.setting) : {};
  };
  const p = alive(w).find((q) => why(q).mem && why(q).belief && homeHouse(w, content, q));
  if (!p) return undefined;
  const law = grievanceOf(w, content, p.id)!.law;
  const [shares, doubts] = alive(w).filter(
    (q) => q !== p && bedOf(w, q) && grievanceOf(w, content, q.id)?.law === law,
  );
  if (!shares || !doubts) return undefined;
  const bed = bedOf(w, p)!;
  for (const q of [shares, doubts]) Object.assign(bedOf(w, q)!, { x: bed['x'], y: bed['y'] });
  const { id: _m, ...mem } = why(p).mem!;
  if (!why(shares).mem) addEntity(w, 'memory', { ...mem, person: shares.id });
  const { id: _b, ...belief } = why(p).belief!;
  if (!why(shares).belief) addEntity(w, 'belief', { ...belief, person: shares.id });
  return { w, p, shares, doubts };
}

describe('a leaver takes only those who share the grievance (P4)', () => {
  it('leaves behind a housemate who does not hold the belief, and they remember it', () => {
    // A hard winter's grievance: a fresh band under Hunger rations for 30 days (`hardWinter`).
    const { w, p, shares, doubts } = hardWinter();
    const g = grievanceOf(w, content, p.id)!;
    const why = reasonsOf(w, content, p.id, g.setting);
    for (const q of [shares, doubts]) {
      const row = (w.entities['defy'] ?? []).find((r) => r['person'] === q.id)!;
      row['step'] = content.defy.steps.findIndex((s) => s.id === 'take') + 1;
      expect(grievanceOf(w, content, q.id)?.law).toBe(g.law);
    }
    expect(reasonsOf(w, content, shares.id, g.setting).belief).toBeDefined();
    w.entities['belief'] = (w.entities['belief'] ?? []).filter((b) => b['person'] !== doubts.id);
    const line = leave(contextFor(w, sim, defySystem), p, g, why);
    const left = findEvent(allLines(w), line)!;
    // The seed's own housemates may share it too (V-195 moved who sleeps where); each one taken
    // holds the grievance and its belief, and the doubter stays.
    expect(left.actors.slice(0, 2)).toEqual([p.id, shares.id]);
    expect(left.actors).not.toContain(doubts.id);
    for (const id of left.actors.slice(2)) {
      expect(grievanceOf(w, content, id)?.law).toBe(g.law);
      expect(reasonsOf(w, content, id, g.setting).belief).toBeDefined();
    }
    expect(
      (w.entities['memory'] ?? []).some(
        (m) => m['person'] === doubts.id && m['memory'] === content.defy.memories['left'],
      ),
    ).toBe(true);
  });
});
