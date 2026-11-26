// 6C Slice 4 (V-237): the lord on screen. Nothing shows before his reeve has named him; after, the
// Laws sheet's Lord block (who, favour with every step, its causes), the Stock sheet's tithe block
// (his last take outlives the sealed day), the reeve on the map and his page, and the Region
// sheet's lord and regards; Slice 7, the lord riding with him to his supper. Worlds as the engine's lord test makes them (smoke/1).
import { describe, expect, it } from 'vitest';
import { content, contentHash } from '../content/index.ts';
import {
  addEntity,
  broughtIn,
  createSim,
  createWorld,
  emit,
  lordRow,
  reeveRow,
  step,
  titheRow,
  today,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  withoutAccidents,
  yearNow,
} from '../engine/index.ts';
import { ruledIds, ruledView } from './lawsheet.ts';
import { regionDetail } from './lordview.ts';
import type { LedgerLine } from './protocol.ts';
import { reevePage, reeveView, titheView } from './reeveview.ts';
import { checkSave, saveOf } from './save.ts';

type Sim = ReturnType<typeof createSim>;
type World = ReturnType<typeof createWorld>;

const line = (e: { id: number; type: string }): LedgerLine => e as unknown as LedgerLine;

/** A harvest home brought in today with its supper eaten (as the engine's lord test does), or
 * (`eaten` false) called for tonight. */
function harvestHome(w: World, sim: Sim, eaten = true): void {
  const home = emit(w, sim.templates, 'farm.harvestHome', {
    causes: [w.begunEvent],
    data: { names: 'the band', crop: 'turnips', count: 2000, what: 'turnips' },
  });
  addEntity(w, 'feast', {
    ...{ line: home, year: yearNow(w, content), state: eaten ? 'eaten' : 'called', start: 0 },
    ...{ there: [], eaten: eaten ? home : 0, couple: [], on: today(w), holy: 0, lean: 0 },
  });
}

/** Runs from midnight on until the reeve is in the valley, or (`gone`) has come and gone. */
function visit(w: World, sim: Sim, gone: boolean): void {
  step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
  for (let h = 0; h < 24; h += 1) {
    if (gone ? reeveRow(w) === undefined && h > 8 : reeveRow(w) !== undefined) return;
    step(w, sim, TICKS_PER_HOUR);
  }
}

describe('the lord on screen', () => {
  const sim = createSim(withoutAccidents(content));
  const fresh = createWorld(sim, 'smoke/1');
  step(fresh, sim, TICKS_PER_HOUR);

  it('shows nothing before the reeve has named him', () => {
    expect(ruledIds(fresh)).not.toContain('lord');
    expect(titheView(fresh)).toBeUndefined();
    expect(regionDetail(fresh)).toEqual({ regard: [] });
    expect(reeveView(fresh)).toBeUndefined();
    expect(reevePage(fresh, line)).toBeUndefined();
  });

  const named = structuredClone(fresh);
  harvestHome(named, sim);
  visit(named, sim, false);
  const riding = structuredClone(named);
  visit(named, sim, true);

  it('draws the reeve while he is in the valley, in the lord people art, and opens his page', () => {
    const lord = lordRow(riding)!;
    const seen = reeveView(riding)!;
    const race = content.cultures.find((c) => c.id === lord['culture'])!.raceId;
    expect(seen).toMatchObject({ race, z: 0 });
    const page = reevePage(riding, line)!;
    expect(page.title).toBe('The reeve');
    expect(page.who).toMatch(
      new RegExp(
        `^${lord['reeve'] as string}, reeve to .+\\. An? \\w+ of the .+, here on the lord's business with his cart\\.$`,
      ),
    );
    expect(page.rows.map((r) => r.name)).toEqual(['Doing now', 'Came', 'Leaves']);
    expect(page.rows[1]).toMatchObject({
      text: expect.stringMatching(/^This morning, up the road from /),
    });
    expect(page.rows[1]!.why).toBe(reeveRow(riding)!['came']);
    expect(page.lines.map((l) => (l as unknown as { type: string }).type)).toContain(
      'lord.reeveCame',
    );
    expect(reeveRow(named)).toBeUndefined();
    expect(reeveView(named)).toBeUndefined();
    expect(reevePage(named, line)).toBeUndefined();
  });

  it('adds the Lord law with who he is, his favour and every step from content', () => {
    expect(ruledIds(named)).toContain('lord');
    const view = ruledView(named, 'lord');
    expect(view.settings.map((s) => s.id)).toEqual(['defiant', 'grudging', 'loyal']);
    const { lord } = view;
    expect(lord!.who).toMatch(
      /^The valley is held by .+ of the .+\. (His|Her) reeve .+ comes the morning after each harvest home; every third harvest home (he|she) comes (him|her)self for the supper\.$/,
    );
    expect(lord!.whoWhy).toBe(lordRow(named)!['named']);
    expect([lord!.favour, lord!.causes]).toEqual([content.lord.favour.start, []]);
    expect(lord!.steps).toEqual(
      content.lord.favour.ladder.map((s) => s.below ?? s.above).sort((a, b) => a! - b!),
    );
    expect(lord!.ladder).toContain(content.lord.favour.ladder[0]!.text);
    expect(lord!.ladder).toMatch(/Each cause counts for 3 years\.$/);
  });

  it('shows the tithe block, and the lord and a village on the Region sheet', () => {
    const tithe = titheView(named)!;
    expect(tithe).toMatchObject({ why: 0 });
    expect(tithe.took).toMatch(/has taken nothing yet/);
    expect(tithe.owed).toMatch(
      /^Owed for the next harvest home: (a tenth|\d+ in 100) of every harvest/,
    );
    expect(tithe.barn).toBe('In the barn for him now: nothing.');
    expect(tithe.apart).toBe('Nothing is set apart in the barn for asks.');
    const world = structuredClone(named);
    addEntity(world, 'regard', { place: 'Kraghurnar', regard: 60, gift: 1, line: 7 });
    const { lord, regard } = regionDetail(world);
    expect(lord!.text).toMatch(/^Held by .+ of the .+\. (His|Her) favour: 50 of 100\.$/);
    expect(regard).toEqual([
      {
        place: 'Kraghurnar',
        regard: 60,
        why: 7,
        text: 'Its regard for the colony: 60. A gift waits for their next stranger.',
      },
    ]);
  });

  it('keeps his last take and its favour cause on the sheets after its day is sealed', () => {
    const later = structuredClone(named);
    const reaped = emit(later, sim.templates, 'field.harvested', {
      causes: [later.begunEvent],
      data: { crop: 'turnips', count: 400, what: 'turnips', kept: 0, x: 1, y: 1, dir: 'east' },
    });
    broughtIn(later, content, 'turnips', 400, reaped);
    titheRow(later, 'turnips')!['barn'] = 25;
    harvestHome(later, sim);
    visit(later, sim, true);
    const took = lordRow(later)!['tithed'] as number;
    const days = later.log.find((e) => e.id === took)!;
    expect(days.type).toBe('lord.tithed');
    step(later, sim, 10 * TICKS_PER_DAY);
    expect(later.log.some((e) => e.id === took)).toBe(false);
    const tithe = titheView(later)!;
    expect(tithe.why).toBe(took);
    expect(tithe.took).toMatch(
      /^On Day \d+ of \w+, Year \d+, .+ took \d+ turnips(, \d+ turnips short)?\.$/,
    );
    const [cause] = ruledView(later, 'lord').lord!.causes;
    expect(cause!.text).toMatch(/, Year \d+$/);
    expect(Math.abs(cause!.by)).toBeGreaterThan(0);
    expect(cause!.why).toBeGreaterThan(0);
  });

  it('draws the lord beside the reeve when he comes himself, and says he stays the night', () => {
    const w = structuredClone(named);
    lordRow(w)!['visits'] = 1;
    step(w, sim, TICKS_PER_HOUR);
    harvestHome(w, sim, false);
    step(w, sim, TICKS_PER_HOUR);
    expect(reeveView(w)).toMatchObject({ lord: true });
    const page = reevePage(w, line)!;
    expect(page.rows.map((r) => r.name)).toEqual([
      ...['Doing now', 'With him', 'Came', 'Leaves'],
      "The lord's favour",
    ]);
    expect(page.rows[0]!.text).toMatch(/^Staying by the hall with /);
    expect(page.rows[1]!.why).toBe(reeveRow(w)!['lord']);
    expect(page.rows[3]!.text).toMatch(/^Tomorrow/);
    // A save of the lord's stay loads, and so does one made before Slice 7 (the rows mended).
    const check = (x: World) =>
      checkSave(structuredClone(saveOf(x, contentHash)), contentHash, content, sim.tables);
    expect(check(w)).toEqual(w);
    // Between his first visit and his first take (refused before the lord's rows were mended).
    expect(check(named)).toEqual(named);
    const old = structuredClone(w);
    for (const k of ['tithed', 'tookAt', 'took', 'came', 'plea']) delete lordRow(old)![k];
    for (const k of ['lord', 'feast', 'wait', 'judged', 'favourIn']) delete reeveRow(old)![k];
    expect(lordRow(check(old))!['plea']).toBe(0);
  });
});
