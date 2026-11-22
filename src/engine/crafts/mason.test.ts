// 6B Bundle 3 part 2 (P6.9, P6.11, V-052): houses grow in stages from need, each with a line
// saying why, and a stage that cannot go on says what it waits for. Worn thatch where slate can
// be had waits for a mason's slate, then is slated; a house that burned a winter's firewood
// through its timber walls is rebuilt in dressed stone; clay walls are limewashed from lime the
// lime burner breaks and burns. Nobody is told which house: the levers are Priorities rows.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { roofLeak, slateCanBeHad, wallsOf, wornThatch } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { layItem, storeOf } from '../goods/index.ts';
import { leakOf } from '../fire/index.ts';
import type { EntityRow } from '../core/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  withoutAccidents,
} from '../index.ts';

const content = withoutAccidents(game);
const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const def = content.buildings.masonry;
const houses = (w: World) => w.entities['house'] ?? [];
const line = (w: World, id: number) => allLines(w).find((e) => e.id === id)!;

/** Steps an hour at a time until a line passes `test`, at most `days` days; the line. */
function until(w: World, test: (e: ReturnType<typeof allLines>[number]) => boolean, days: number) {
  for (let h = 0; h < days * 24; h += 1) for (const e of step(w, sim, 60)) if (test(e)) return e;
  return undefined;
}

/** The player's lever: `job` raised to first for everyone (V-041); nobody is told which house. */
function raise(w: World, ...jobs: string[]): void {
  for (const p of w.entities['person'] ?? [])
    for (const job of jobs)
      submitCommand(w, {
        tick: w.tick + 1,
        kind: 'setPriority',
        data: { person: p.id, job, level: 1 },
      });
}

/** A world `days` days on with its first house built and roofed; that house. */
function roofedHouse(seed: string): { w: World; h: EntityRow } {
  const w = createWorld(sim, seed);
  const roofed = until(w, (e) => e.type === 'build.roofed', 30)!;
  return { w, h: houses(w).find((r) => r['roofLine'] === roofed.id)! };
}

/** Lays goods in the colony's store, where anyone can reach them. */
const lay = (w: World, kind: string, count: number) => {
  const s = storeOf(w)[0]!;
  layItem(w, { kind, count, x: s['x'] as number, y: s['y'] as number, z: 0, made: 1 });
};

/** The air leak of the room inside house row `h`. */
const leak = (w: World, h: EntityRow) =>
  leakOf(w, content, { id: 0, x: (h['x'] as number) + 1, y: (h['y'] as number) + 1 } as EntityRow);

describe('houses grow in stages', () => {
  it('worn thatch where slate can be had waits for a mason’s slate, then is slated', () => {
    // ledger since the 250-tile valley (V-201): anvil has no slate within reach now (searched
    // 2026-11-22: ledger, cairn and bryn have it).
    const { w, h } = roofedHouse('ledger');
    expect(slateCanBeHad(w, content)).toBe(true);
    const year = content.calendar.daysPerMonth * content.calendar.monthsPerYear * DAY;
    h['roofed'] = w.tick - content.buildings.roofs.thatch.wears * year;
    raise(w, def.mason.job);
    const wanted = until(w, (e) => e.type === 'build.stageWanted', 1)!;
    expect(String(wanted.data['what'])).toMatch(/slate/);
    expect(wanted.causes).toContain(h['roofLine']);
    const waits = until(w, (e) => e.type === 'build.stageWaits', 1)!;
    expect(waits.data['lack']).toBe('no mason has split any slate yet');
    expect(waits.causes).toEqual([wanted.id]);
    const split = until(w, (e) => e.type === 'mason.split', 6)!;
    expect(split.data['slate']).toBe(def.mason.split.slate);
    const slated = until(w, (e) => e.type === 'mason.slated', 6)!;
    const took = line(w, slated.causes[0]!);
    expect(took.type).toBe('work.tookUpMasonry');
    expect(took.causes).toContain(wanted.id);
    expect(
      allLines(w).some((e) => took.causes.includes(e.id) && e.type === 'work.prioritySet'),
    ).toBe(true);
    expect(h['roof']).toBe('slate');
    // Slate never wears: years on it still holds.
    h['roofed'] = w.tick - 20 * year;
    expect(wornThatch(w, content, h)).toBe(false);
    expect(roofLeak(w, content, (h['x'] as number) + 1, (h['y'] as number) + 1)).toBe(0);
  });

  it('a house that burned a winter’s firewood through timber walls is rebuilt in dressed stone', () => {
    const { w, h } = roofedHouse('anvil');
    const st = def.stages.stone;
    const walls = wallsOf(w, h, st.from);
    expect(walls.length).toBeGreaterThan(0);
    // Anvil has no limestone, so its walls are set in clay. Dressed stone for all but one wall.
    lay(w, 'ashlar', 3 * walls.length - 1);
    // Clay for these and the rooms the house adds meanwhile; stone for their dressing.
    lay(w, 'stone', 20);
    lay(w, 'clay', 40);
    const before = leak(w, h);
    h['burned'] = st.burned + 4;
    raise(w, def.mason.job);
    const wanted = until(w, (e) => e.type === 'build.stageWanted', 1)!;
    expect(wanted.data['why']).toBe(
      `burned ${st.burned + 4} firewood this winter through its wood walls`,
    );
    expect(h['mortar']).toBe('clay');
    const rebuilt = until(w, (e) => e.type === 'build.rebuilt', 30)!;
    expect(rebuilt.data['mortar']).toBe('clay');
    expect(allLines(w).some((e) => e.type === 'mason.dressed')).toBe(true);
    expect(wallsOf(w, h, st.from)).toHaveLength(0);
    expect(wallsOf(w, h, [st.clay]).length).toBeGreaterThanOrEqual(walls.length);
    expect(leak(w, h)).toBeLessThan(before);
  });

  it('clay walls are limewashed from lime the lime burner breaks and burns at the kiln', () => {
    const { w, h } = roofedHouse('tallow');
    const wash = def.stages.wash;
    const parts = content.buildings.parts;
    // Clay walls, as a seed that built in daub would have them.
    for (const r of wallsOf(w, h, def.stages.stone.from)) {
      r['part'] = wash.from;
      w.map.built[(r['y'] as number) * w.map.width + (r['x'] as number)] =
        parts.findIndex((p) => p.id === wash.from) + 1;
    }
    const kx = w.map.startX - 7;
    addEntity(w, 'station', {
      ...{ kind: 'kiln', x: kx, y: w.map.startY, z: 0, w: 2, h: 2, state: 'built', line: 1 },
      ...{ have: 8, work: 0, made: 1, lit: 0, litLine: 0, alert: 0, waitFor: '', sent: 0 },
    });
    lay(w, 'firewood', 20);
    const before = leak(w, h);
    raise(w, def.mason.job, def.lime.job);
    const wanted = until(w, (e) => e.type === 'build.stageWanted', 1)!;
    expect(String(wanted.data['what'])).toMatch(/limewashed/);
    expect(until(w, (e) => e.type === 'lime.broke', 6)).toBeDefined();
    expect(until(w, (e) => e.type === 'lime.burned', 6)).toBeDefined();
    const washed = until(w, (e) => e.type === 'mason.washed', 6)!;
    expect(washed).toBeDefined();
    expect(wallsOf(w, h, [wash.from])).toHaveLength(0);
    expect(leak(w, h)).toBeLessThan(before);
  });
});
