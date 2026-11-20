// 6B Bundle 5 (P6.12, V-188): the colony sites a tavern once the harvest is in (never a home), the
// innkeeper pours ale from a ready cask of an evening, tales are told there more than anywhere,
// a brewer fills an empty cask (grain only while food is above its plate), a hot-tempered drinker
// may come to blows and a heavy drinker wakes hung over. No lever but the Build and Work sheets.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  buildSystem,
  createSim,
  createWorld,
  emit,
  finishPlan,
  inStore,
  itemsAt,
  layItem,
  plansOf,
  step,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  withoutAccidents,
  type EngineContent,
  type EntityRow,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { roomAt, rectOf, tavernHouse } from '../build/index.ts';
import { fillCask, nightOf, tavernOf } from './tables.ts';

type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** A world past its harvest home with the Tavern row at 1, run until the tavern is sited; its
 * walls are then finished at once and its casks, tub and counter set in (builders and carpenters
 * are their own flows), and it is named. */
function withTavern(seed: string, tuned: EngineContent = withoutAccidents(content)) {
  const sim = createSim(tuned);
  const w = createWorld(sim, seed);
  step(w, sim, TICKS_PER_HOUR);
  const feast = addEntity(w, 'feast', {
    ...{ line: w.begunEvent, year: 1, state: 'eaten', start: 0, there: [], eaten: w.begunEvent },
    ...{ couple: [], on: 0, holy: 0, lean: 0 },
  });
  addEntity(w, 'want', { kind: 'tavern', level: 1, line: 0 });
  for (let h = 0; h < 3 && !tavernHouse(w); h += 1) step(w, sim, TICKS_PER_HOUR);
  const h = tavernHouse(w)!;
  const ctx = contextFor(w, sim, buildSystem);
  for (const p of plansOf(w).filter((r) => r['house'] === h.id))
    finishPlan(ctx, p, h['line'] as number);
  step(w, sim, TICKS_PER_HOUR);
  const r = rectOf(h);
  const room = roomAt(w, tuned, r.x + 1, r.y + 1)!;
  const width = w.map.width;
  const kinds = ['ale-cask', 'ale-cask', 'brew-tub', 'counter'];
  const pieces = kinds.map((kind, k) => {
    const i = room.tiles[k]!;
    return addEntity(w, 'furniture', {
      ...{ kind, x: i % width, y: Math.floor(i / width), z: 0, facing: 's', quality: 0 },
      ...{ maker: 0, owner: 0, made: h['line'] as number, line: h['line'] as number },
      ...{ state: 'built', have: 0 },
      ...{ work: 0, waited: 0 },
    });
  });
  step(w, sim, TICKS_PER_HOUR);
  return { w, sim, h, feast, casks: pieces.slice(0, 2) };
}

/** Runs to the next evening's end (bedtime). */
const evening = (w: World, sim: ReturnType<typeof createSim>) => step(w, sim, TICKS_PER_DAY);

describe('the tavern', () => {
  it('is sited after the harvest home, named, kept, and is nobody home', () => {
    const { w, sim, h, feast } = withTavern('anvil');
    const sited = lines(w, 'build.tavern')[0]!;
    expect(sited.causes).toContain(
      (w.entities['feast'] ?? []).find((f) => f.id === feast)!['line'],
    );
    expect(h['state']).toBe('built');
    expect(lines(w, 'tavern.named')).toHaveLength(1);
    expect(content.tavern.build.names).toContain(tavernOf(w)!['name']);
    const keeper = alive(w).find((p) => p.id === tavernOf(w)!['keeper']);
    expect(keeper).toBeDefined();
    // Nobody lays their bedroll in it.
    const r = rectOf(h);
    const inside = (i: EntityRow) =>
      (i['x'] as number) > r.x &&
      (i['x'] as number) < r.x + r.w - 1 &&
      (i['y'] as number) > r.y &&
      (i['y'] as number) < r.y + r.h - 1;
    step(w, sim, 2 * TICKS_PER_DAY);
    expect(
      (w.entities['item'] ?? []).filter(
        (i) => i['kind'] === 'bedroll' && i['state'] === 'laid' && inside(i),
      ),
    ).toEqual([]);
  });

  it('waits at "last" on the Build sheet', () => {
    const sim = createSim(content);
    const w = createWorld(sim, 'smoke');
    addEntity(w, 'feast', {
      ...{ line: w.begunEvent, year: 1, state: 'eaten', start: 0, there: [], eaten: w.begunEvent },
      ...{ couple: [], on: 0, holy: 0, lean: 0 },
    });
    addEntity(w, 'want', { kind: 'tavern', level: 4, line: 0 });
    step(w, sim, 6 * TICKS_PER_HOUR);
    expect(lines(w, 'build.tavern')).toEqual([]);
  });

  it('pours ale of an evening, and most tellings are there once it stands', () => {
    const { w, sim, casks } = withTavern('tallow');
    for (const c of casks)
      fillCask(w, c, { drink: 'ale', cups: 20, ready: w.tick, line: w.begunEvent });
    const from = w.tick;
    // Something happens to someone each day: a tale to tell.
    for (let d = 0; d < 6; d += 1) {
      const p = alive(w)[d % alive(w).length]!;
      emit(w, sim.templates, 'wild.attacked', {
        actors: [p.id],
        causes: [w.begunEvent],
        data: {
          species: 'wolf',
          name: p['name'] as string,
          why: 'at the wood edge',
          fight: '',
          bitten: '',
        },
      });
      evening(w, sim);
    }
    const cups = (w.entities['memory'] ?? []).filter(
      (m) => m['memory'] === content.tavern.evening.cup,
    );
    expect(cups.length).toBeGreaterThan(0);
    const told = lines(w, 'tale.told').filter((e) => e.tick >= from);
    const there = told.filter((e) => e.data['where'] === content.tales.places.tavern);
    expect(told.length).toBeGreaterThan(0);
    expect(there.length * 2).toBeGreaterThan(told.length);
  });

  it('leaves the dry tavern after an hour', () => {
    const { w, sim } = withTavern('smoke');
    for (let d = 0; d < 3; d += 1) evening(w, sim);
    const nights = (w.entities['night'] ?? []).filter((n) => n['came'] && n['leave']);
    expect(nights.length).toBeGreaterThan(0);
    for (const n of nights)
      expect((n['leave'] as number) - (n['came'] as number)).toBeLessThanOrEqual(
        content.tavern.evening.leave + TICKS_PER_HOUR,
      );
    expect(
      (w.entities['memory'] ?? []).some((m) => m['memory'] === content.tavern.evening.cup),
    ).toBe(false);
  });

  it('brews into an empty cask, but keeps the grain for eating while food is short', () => {
    const { w, sim } = withTavern('anvil');
    for (const p of alive(w))
      addEntity(w, 'priority', { person: p.id, job: 'brew', level: 1, line: 0, declined: 0 });
    // Grain in the store (the cart brings none).
    const tile = (w.entities['store'] ?? []).find((t) => {
      const [x, y, z] = [t['x'] as number, t['y'] as number, t['z'] as number];
      return inStore(w, x, y, z) && !itemsAt(w, x, y, z).length;
    })!;
    layItem(w, {
      kind: 'grain',
      count: 20,
      x: tile['x'] as number,
      y: tile['y'] as number,
      z: 0,
      made: w.begunEvent,
    });
    // The store's food under its "plenty" plate: no brewing, one line.
    for (const i of w.entities['item'] ?? [])
      if (i['kind'] === 'preserved') i['count'] = Math.min(i['count'] as number, 10);
    for (let d = 0; d < 2; d += 1) step(w, sim, TICKS_PER_DAY);
    expect(lines(w, 'tavern.noGrain')).toHaveLength(1);
    expect(lines(w, 'tavern.brewed')).toEqual([]);
    const food = (w.entities['stock'] ?? []).find((s) => s['good'] === 'food')!;
    // With food at "some" the store is past its plate again.
    for (const i of w.entities['item'] ?? []) if (i['kind'] === 'preserved') i['count'] = 40;
    food['level'] = 'some';
    for (let d = 0; d < 3 && !lines(w, 'tavern.brewed').length; d += 1) step(w, sim, TICKS_PER_DAY);
    const brewed = lines(w, 'tavern.brewed')[0]!;
    expect(brewed.data['drink']).toBe('ale');
    const keg = (w.entities['keg'] ?? [])[0]!;
    expect(keg['cups']).toBe(content.tavern.brew.cups);
    expect(keg['ready']).toBe(brewed.tick + content.tavern.brew.days * TICKS_PER_DAY);
  });

  it('a hot-tempered drinker may come to blows over a second cup', () => {
    const tuned: EngineContent = {
      ...withoutAccidents(content),
      tavern: {
        ...content.tavern,
        evening: { ...content.tavern.evening, go: 100 },
        brawl: { ...content.tavern.brawl, chance: 100 },
      },
    };
    const { w, sim, casks } = withTavern('tallow', tuned);
    for (const c of casks)
      fillCask(w, c, { drink: 'ale', cups: 20, ready: w.tick, line: w.begunEvent });
    for (const p of alive(w))
      addEntity(w, 'trait', { person: p.id, trait: content.tavern.brawl.trait });
    for (let d = 0; d < 4 && !lines(w, 'tavern.brawled').length; d += 1) evening(w, sim);
    const brawl = lines(w, 'tavern.brawled')[0]!;
    expect(brawl.actors).toHaveLength(2);
    expect(brawl.causes.length).toBeGreaterThan(0);
    const hurt = (w.entities['wound'] ?? []).filter((x) =>
      brawl.actors.includes(x['person'] as number),
    );
    expect(hurt.length).toBeGreaterThanOrEqual(2);
  });

  it('wakes a heavy drinker hung over, slower at work until noon', () => {
    const tuned: EngineContent = {
      ...withoutAccidents(content),
      tavern: {
        ...content.tavern,
        evening: { ...content.tavern.evening, go: 100 },
        hungOver: { ...content.tavern.hungOver, after: 1 },
      },
    };
    const { w, sim, casks } = withTavern('smoke', tuned);
    for (const c of casks)
      fillCask(w, c, { drink: 'ale', cups: 20, ready: w.tick, line: w.begunEvent });
    for (let d = 0; d < 3; d += 1) evening(w, sim);
    const hung = (w.entities['memory'] ?? []).filter(
      (m) => m['memory'] === content.tavern.hungOver.memory,
    );
    expect(hung.length).toBeGreaterThan(0);
    const n = nightOf(w, hung[0]!['person'] as number)!;
    expect((n['hung'] as number) % TICKS_PER_DAY).toBe(
      content.tavern.hungOver.until * TICKS_PER_HOUR,
    );
  });

  it('the bard makes a song of a big event, and its bigger version spreads', () => {
    const tuned: EngineContent = {
      ...withoutAccidents(content),
      tavern: { ...content.tavern, evening: { ...content.tavern.evening, go: 100 } },
    };
    const { w, sim, casks } = withTavern('tallow', tuned);
    for (const c of casks)
      fillCask(w, c, { drink: 'ale', cups: 20, ready: w.tick, line: w.begunEvent });
    const bard = alive(w).find((p) => p.id !== tavernOf(w)!['keeper'])!;
    addEntity(w, 'priority', { person: bard.id, job: 'bard', level: 1, line: 0, declined: 0 });
    const seen = emit(w, sim.templates, 'wild.attacked', {
      actors: [bard.id],
      causes: [w.begunEvent],
      data: {
        species: 'wolf',
        name: bard['name'] as string,
        why: 'at the wood edge',
        fight: '',
        bitten: '',
      },
    });
    for (let d = 0; d < 8 && !lines(w, 'song.sung').length; d += 1) evening(w, sim);
    const made = lines(w, 'song.made')[0]!;
    expect(made.actors).toEqual([bard.id]);
    expect(made.causes).toEqual([seen]);
    const sung = lines(w, 'song.sung')[0]!;
    expect(sung.causes).toEqual([made.id]);
    // Those who heard it hold the song's version, one level bigger than the bard's, from the song.
    const heard = (w.entities['tale'] ?? []).filter((t) => t['line'] === sung.id);
    expect(heard.length).toBeGreaterThan(0);
    for (const t of heard) expect(t['level']).toBe(2);
    expect(
      (w.entities['memory'] ?? []).filter((m) => (m['memory'] as string).startsWith('heard-song')),
    ).not.toEqual([]);
    // The song's version gives the bard a byname of their own.
    const named = lines(w, 'tale.byname')[0]!;
    expect(named.causes).toEqual([sung.id]);
    expect(named.data['word']).toBe('Lucky');
  });
});
