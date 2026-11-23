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

  it('comes the morning after a harvest home whose supper was never eaten (V-219)', () => {
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
