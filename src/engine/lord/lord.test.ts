// 6C Slice 1 (V-216): the colony's lord is the ruler of the nearest valley neighbour's realm that
// still stands; the reeve comes the morning after each harvest home, names the lord the first time
// and counts the store after; a save carries the lord; a fallen realm is skipped.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
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
  yearNow,
  valleyOf,
  withoutAccidents,
} from '../index.ts';
import { storyWorld } from '../region/story.ts';
import { kindOf, lordIn } from '../region/lord.ts';
import { lordName, lordRow, reeveRow } from './index.ts';
import { titleOf } from './tables.ts';
import { broughtIn, hideFromBarn, layItem, raidsBarn, titheRow } from '../index.ts';
import { lordSystem } from './system.ts';
import { defySystem } from '../defy/index.ts';
import { stopFor } from '../health/index.ts';
import { contextFor } from '../sim/system.ts';
import { rateOf } from './tithe.ts';

type World = ReturnType<typeof createWorld>;
const SEED = 'smoke/1';
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** A harvest home brought in today and its supper eaten, or (`eaten` false) called and never eaten
 * (the farm's own run takes 140 days). */
function harvestHome(w: World, sim: ReturnType<typeof createSim>, eaten = true): number {
  const home = emit(w, sim.templates, 'farm.harvestHome', {
    causes: [w.begunEvent],
    data: { names: 'the band', crop: 'turnips', count: 2000, what: 'turnips' },
  });
  const year = yearNow(w, content);
  addEntity(w, 'feast', {
    ...{ line: home, year, state: eaten ? 'eaten' : 'called', start: 0, there: [] },
    eaten: eaten ? home : 0,
    ...{ couple: [], on: today(w), holy: 0, lean: 0 },
  });
  return home;
}

/** Runs to the next midnight, then on until the reeve has come and gone (at most a day). */
function untilGone(w: World, sim: ReturnType<typeof createSim>): void {
  step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
  for (let h = 0; h < 24 && !(reeveRow(w) === undefined && h > 8); h += 1)
    step(w, sim, TICKS_PER_HOUR);
}

describe('the lord and the reeve', () => {
  const sim = createSim(withoutAccidents(content));
  const w = createWorld(sim, SEED);
  step(w, sim, TICKS_PER_HOUR);
  const first = harvestHome(w, sim);
  untilGone(w, sim);

  it("is the nearest live realm's ruler, named the morning after the first harvest home", () => {
    const found = valleyOf(SEED, content)!;
    const world = storyWorld('smoke', content);
    const near = found.valley.near[0]!;
    const site = [...world.sites.values()].find((s) => s.name === near.name)!;
    const civ = world.civs.get(site.civId!) as { fell?: number; rulerId?: number; name: string };
    expect(civ.fell).toBeUndefined();
    const lord = lordRow(w)!;
    expect(lord['ruler']).toBe(civ.rulerId);
    expect(lord['realm']).toBe(civ.name);
    expect(lord['title']).toBe(titleOf(content, kindOf(civ.name), lord['sex'] as string));
    const [came] = lines(w, 'lord.reeveCame');
    const [named] = lines(w, 'lord.named');
    expect(came!.causes).toContain(first);
    expect(named!.causes).toContain(first);
    // The morning after, from the hour he comes, and gone home before dark.
    expect(Math.floor(came!.tick / TICKS_PER_DAY)).toBe(1);
    expect(Math.floor((came!.tick % TICKS_PER_DAY) / TICKS_PER_HOUR)).toBe(
      content.lord.reeve.arrive,
    );
    const [left] = lines(w, 'lord.reeveLeft');
    expect(left!.tick % TICKS_PER_DAY).toBeLessThanOrEqual(content.lord.reeve.leave * 60);
    expect(reeveRow(w)).toBeUndefined();
    // Everyone remembers the news; one not of the lord's people bitterly.
    const held = (w.entities['memory'] ?? []).filter((m) => m['line'] === named!.id);
    const living = (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
    expect(held).toHaveLength(living.length);
    for (const m of held) {
      const p = living.find((x) => x.id === m['person'])!;
      const want = p['culture'] === lord['culture'] ? 'lord-named' : 'lord-bitter';
      expect(m['memory']).toBe(want);
    }
  });

  it('is carried by a save, and the next harvest home the reeve counts the store', () => {
    // A save is a structured clone of the world (persist, IndexedDB); the region is not in it.
    const loaded = structuredClone(w);
    expect(lordRow(loaded)).toEqual(lordRow(w));
    const second = harvestHome(loaded, sim);
    untilGone(loaded, sim);
    const [counted] = lines(loaded, 'lord.counted');
    expect(counted!.causes).toContain(second);
    expect(counted!.data['lord']).toBe(lordName(lordRow(loaded)!));
    expect(lines(loaded, 'lord.named')).toHaveLength(1);
  });

  it('comes the morning after a harvest home whose supper was never eaten (V-220)', () => {
    // Test world 1 lost its year-3 visit this way: the supper lapsed and the reeve waited on it.
    const later = structuredClone(w);
    const home = harvestHome(later, sim, false);
    const day = today(later);
    untilGone(later, sim);
    const came = lines(later, 'lord.reeveCame').filter((e) => e.causes.includes(home));
    expect(came).toHaveLength(1);
    expect(came[0]!.causes).toEqual([home]);
    expect(Math.floor(came[0]!.tick / TICKS_PER_DAY)).toBe(day + 1);
    const counted = lines(later, 'lord.counted').filter((e) => e.causes.includes(home));
    expect(counted).toHaveLength(1);
  });

  it('sets the Lord law Loyal on his word, and everyone answers it (6C Slice 2)', () => {
    const [named] = lines(w, 'lord.named');
    const set = lines(w, 'law.set').find((e) => e.data['law'] === 'Lord law')!;
    expect(set.causes).toEqual([named!.id]);
    expect(set.data['setting']).toBe('Loyal');
    const answers = lines(w, 'law.answered').filter((e) => e.causes.includes(set.id));
    const living = (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
    expect(answers.map((e) => e.actors[0]).sort()).toEqual(living.map((p) => p.id).sort());
  });

  it('counts the barn against the share of what was brought in, and names what is short', () => {
    const later = structuredClone(w);
    const ctx = contextFor(later, sim, lordSystem);
    const reaped = emit(later, sim.templates, 'field.harvested', {
      causes: [later.begunEvent],
      data: { crop: 'turnips', count: 400, what: 'turnips', kept: 0, x: 1, y: 1, dir: 'east' },
    });
    broughtIn(later, content, 'turnips', 400, reaped);
    titheRow(later, 'turnips')!['barn'] = 25;
    const rate = rateOf(ctx);
    const home = harvestHome(later, sim);
    untilGone(later, sim);
    const [tithed] = lines(later, 'lord.tithed');
    expect(tithed!.causes).toContain(home);
    expect(tithed!.causes).toContain(reaped);
    const full = Math.floor((400 * rate) / 100);
    const half = String(tithed!.data['lean']).includes('half');
    const owed = half ? Math.floor(full / 2) : full;
    expect(tithed!.data['owedN']).toBe(owed);
    expect(tithed!.data['thereN']).toBe(25);
    expect(tithed!.data['tookN']).toBe(Math.min(25, owed));
    expect(tithed!.data['shortN']).toBe(owed - Math.min(25, owed));
    expect(String(tithed!.data['short'])).toContain(owed > 25 ? `${owed - 25} turnips` : 'Nothing');
    expect(titheRow(later, 'turnips')!['brought']).toBe(0);
  });

  it('counts what he leaves in the barn towards the next share', () => {
    const later = structuredClone(w);
    broughtIn(later, content, 'turnips', 400, later.begunEvent);
    titheRow(later, 'turnips')!['barn'] = 100;
    harvestHome(later, sim);
    untilGone(later, sim);
    const [tithed] = lines(later, 'lord.tithed');
    const row = titheRow(later, 'turnips')!;
    expect(row['barn']).toBe(100 - (tithed!.data['tookN'] as number));
    expect(row['set']).toBe(row['barn']);
  });

  it('lets someone hungry take from the barn, the line citing their memory and belief', () => {
    const later = structuredClone(w);
    step(later, sim, 2 * TICKS_PER_DAY);
    const food = new Set(content.items.filter((i) => i.good === 'food').map((i) => i.id));
    later.entities['item'] = (later.entities['item'] ?? []).filter(
      (i) => !food.has(i['kind'] as string),
    );
    broughtIn(later, content, 'grain', 300, later.begunEvent);
    titheRow(later, 'grain')!['barn'] = 30;
    const p = (later.entities['person'] ?? []).find((q) => q['status'] === 'alive')!;
    const ctx = contextFor(later, sim, defySystem);
    expect(raidsBarn(ctx, p)).toBe(false);
    const said = allLines(later).at(-1)!.id;
    addEntity(later, 'memory', {
      ...{
        person: p.id,
        memory: content.defy.starving.memory,
        until: later.tick + TICKS_PER_DAY * 4,
      },
      ...{ line: said, about: 0, weight: 1, since: later.tick, first: 0, last: 0, days: 1 },
      ...{ mask: 1, fresh: 1 },
    });
    addEntity(later, 'belief', {
      ...{ person: p.id, belief: content.defy.starving.belief, strength: 2, line: said },
      fed: later.tick,
    });
    expect(raidsBarn(ctx, p)).toBe(true);
    hideFromBarn(ctx, p);
    const [hid] = lines(later, 'defy.hidTithe');
    expect(hid!.actors).toEqual([p.id]);
    expect(hid!.causes).toEqual([said]);
    expect(hid!.data['why']).toMatch(/went to bed hungry; .*this valley cannot feed us/);
    expect(titheRow(later, 'grain')!['barn']).toBe(30 - content.defy.take.count);
    const stash = (later.entities['item'] ?? []).find((i) => i['made'] === hid!.id)!;
    expect([stash['holder'], stash['state'], stash['kind']]).toEqual([p.id, 'hid', 'grain']);
  });

  it('carries the share into a standing barn, unordered, where nobody can eat it', () => {
    const later = structuredClone(w);
    const p = (later.entities['person'] ?? []).find((q) => q['status'] === 'alive')!;
    const [x, y] = [p['x'] as number, p['y'] as number];
    addEntity(later, 'house', {
      ...{ size: 'lean-to', x: x - 1, y: y - 1, w: 3, h: 3, door: -1, of: 0, state: 'built' },
      ...{ line: 0, why: '', sent: 0, built: 0, inn: 3 },
    });
    const reaped = later.begunEvent;
    layItem(later, { kind: 'turnips', count: 60, x: x + 3, y, z: 0, made: reaped });
    broughtIn(later, content, 'turnips', 400, reaped);
    const share = Math.floor((400 * rateOf(contextFor(later, sim, lordSystem))) / 100);
    for (let h = 0; h < 72 && !lines(later, 'lord.barned').length; h += 1)
      step(later, sim, TICKS_PER_HOUR);
    const row = titheRow(later, 'turnips')!;
    expect(lines(later, 'lord.barned')).toHaveLength(1);
    expect(row['barn']).toBe(Math.min(60, share));
    const left = (later.entities['item'] ?? []).filter((i) => i['kind'] === 'turnips');
    expect(left.reduce((n, i) => n + (i['count'] as number), 0)).toBeLessThanOrEqual(
      60 - Math.min(60, share),
    );
  });

  it('gives a dropped share back to the colony, due again, when its hauler is hurt', () => {
    const later = structuredClone(w);
    const p = (later.entities['person'] ?? []).find((q) => q['status'] === 'alive')!;
    broughtIn(later, content, 'turnips', 400, later.begunEvent);
    Object.assign(titheRow(later, 'turnips')!, { due: 0, set: 20 });
    const id = layItem(
      later,
      { kind: 'turnips', count: 20, x: p['x'] as number, y: p['y'] as number, z: 0, made: 0 },
      { state: 'tithe' },
    );
    const load = (later.entities['item'] ?? []).find((i) => i.id === id)!;
    load['holder'] = p.id;
    stopFor(contextFor(later, sim, lordSystem), p, true);
    expect(load['state']).toBe('');
    expect(load['holder']).toBe(0);
    expect(titheRow(later, 'turnips')).toMatchObject({ due: 20, set: 0 });
  });

  it('skips a realm that fell in history for the next that stands', () => {
    const { region, valley } = valleyOf(SEED, content)!;
    const world = storyWorld('smoke', content);
    const before = lordIn(world, region.sites, valley, content)!;
    const civs = new Map(world.civs);
    for (const [id, c] of civs) if (c.name === before.realm) civs.set(id, { ...c, fell: 100 });
    const after = lordIn({ ...world, civs }, region.sites, valley, content)!;
    expect(after.realm).not.toBe(before.realm);
    expect(after.id).not.toBe(before.id);
  });
});
