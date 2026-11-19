// Fires and work in progress as the page shows them (P3.6): a hearth's rows, a room's warmth with
// the fire's heat in it, the doing-now words of tending and making a hearth, the hearth's art by
// state, and the progress of a plan being worked. A hard winter so fires are lit and tended.
import { describe, expect, it } from 'vitest';
import { content as game } from '../content/index.ts';
import { withoutAccidents } from '../engine/index.ts';
import {
  createSim,
  createWorld,
  feltAt,
  furnitureOf,
  housesOf,
  rectOf,
  roomAt,
  step,
  tileTemperature,
} from '../engine/index.ts';
import { tileView } from './views.ts';
import { goodsOf, tileGoods } from './goods.ts';
import { tileHouse } from './build.ts';
import { walkersOf } from './people.ts';

// Accidents (P5.6) are left out: this tests fire views, not injury (health.test.ts does).
const content = withoutAccidents(game);

const winter = {
  ...content,
  seasons: { ...content.seasons, months: content.seasons.months.map(() => -12) },
};
const sim = createSim(winter);
const nobody = () => ({}) as never;
type World = ReturnType<typeof createWorld>;

// Both tests run the same hard winter from 'ledger', so they share one run: the first steps it
// a minute at a time for 6 days, and from the first hour on each hour's warmth rows are read as
// the second used to read them (it carries on hourly to day 12 if it needs to). The world as it
// stood when the second test's search ended is kept for its reads.
let shared:
  | {
      w: World;
      hours: number;
      room?: { x: number; y: number; warmth: string };
      says: string[];
      found?: World;
    }
  | undefined;
const run = () => (shared ??= { w: createWorld(sim, 'ledger'), hours: 0, says: [] });
/** Reads the warmth rows at the end of an hour, until the search is done. */
function hourRead(r: NonNullable<typeof shared>) {
  r.hours += 1;
  if (r.found) return;
  for (const house of housesOf(r.w).filter((q) => q['state'] === 'built')) {
    const q = rectOf(house);
    const row = tileHouse(r.w, q.x + 2, q.y + 1, nobody).room;
    if (row && /no hearth/.test(row.warmth)) r.says.push(row.warmth);
  }
  for (const f of furnitureOf(r.w).filter((p) => p['kind'] === 'hearth')) {
    const [x, y] = [f['x'] as number, f['y'] as number];
    if (!roomAt(r.w, winter, x, y)) continue;
    const row = tileHouse(r.w, x, y, nobody).room;
    if (row && /hearth lit/.test(row.warmth)) r.room = { x, y, warmth: row.warmth };
  }
  if (r.room && r.says.length) r.found = structuredClone(r.w);
}

describe('fire views', () => {
  it('says what the fire is, its fuel and the room it warms, and never falls back to hauling', () => {
    const r = run();
    const w = r.w;
    const words = new Set<string>();
    const arts = new Set<string>();
    const bars: Record<string, number[]> = {};
    const starts: Record<string, number> = {};
    for (let minute = 0; minute < 6 * 1440; minute += 1) {
      step(w, sim, 1);
      if (minute % 60 === 59) hourRead(r);
      if (minute % 3) continue;
      const goods = goodsOf(w);
      for (const f of goods.furniture) arts.add(f.art);
      for (const b of goods.work) {
        expect(b.total).toBeGreaterThan(0);
        expect(b.done).toBeGreaterThanOrEqual(0);
        expect(b.done).toBeLessThanOrEqual(b.total);
        // A tile's next bar of the same total (a hearth's making after the floor's laying, or a
        // person's job there) starts again from near nothing (under a tenth): a new run. Any other
        // drop stays in the run and fails the check below.
        // Per worker: two cooks may share a hearth, each with a bar of their own.
        const tile = `${b.x},${b.y},${b.total},${b.by ?? 0}`;
        const last = bars[`${tile},${starts[tile] ?? 0}`]?.at(-1);
        if (last !== undefined && b.done < last && b.done * 10 < b.total)
          starts[tile] = (starts[tile] ?? 0) + 1;
        (bars[`${tile},${starts[tile] ?? 0}`] ??= []).push(b.done);
      }
      if (minute % 30 === 0) for (const p of walkersOf(w)) words.add(p.now.text);
    }

    // The progress of a plan being worked only moves forward, from near nothing towards its total.
    const runs = Object.values(bars);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) expect(run).toEqual([...run].sort((a, b) => a - b));
    expect(runs.some((r) => r.length > 3 && r.at(-1)! > r[0]!)).toBe(true);

    // The hearth's art follows its fire, and the words are the work.json ones.
    expect(arts.has('furn.hearth')).toBe(true);
    expect(arts.has('furn.hearth.lit')).toBe(true);
    const seen = [...words];
    expect(seen.some((t) => /^Making the (campfire|hearth)/.test(t))).toBe(true);
    expect(seen.some((t) => /^(Tending: |Splitting logs|Warming up)/.test(t))).toBe(true);
    expect(seen.some((t) => /\{/.test(t))).toBe(false);

    // A fire in the open warms to its full radius; a room's hearth to the room's far side (by
    // day 6 of a hard winter the band may be indoors and the campfire burnt down).
    const fire = goodsOf(w).fires[0]!;
    const indoors = !!roomAt(w, winter, fire.x, fire.y);
    expect(fire.radius).toBeGreaterThanOrEqual(indoors ? 2 : content.work.fire.radius);
    const piece = tileGoods(w, fire.x, fire.y, 0, nobody).piece!;
    expect(piece.fire?.state).toMatch(/^(lit|banked)/);
    expect(piece.fire?.fuel).toMatch(/^firewood, (\d+ h)?( ?\d+ min)? left/);
    expect(piece.fire?.lastLabel).toBeTruthy();
    expect(piece.name).toMatch(/^(campfire|hearth)$/);
    // The tile's temperature includes the fire's heat; beside the fire it is above the weather.
    const i = fire.y * w.map.width + fire.x;
    const view = tileView(w, fire.x, fire.y, 0, nobody)!;
    expect(view.temperature).toBe(feltAt(w, winter, i));
    expect(view.temperature!).toBeGreaterThan(tileTemperature(winter, w.map, -12, i));
  });

  it('gives a room a warmth row with its degrees and its hearth', () => {
    const r = run();
    while (r.hours < 12 * 24 && !r.found) {
      step(r.w, sim, 60);
      hourRead(r);
    }
    const w: World = r.found ?? r.w;
    const { room, says } = r;
    expect(room).toBeDefined();
    const degrees = feltAt(w, winter, room!.y * w.map.width + room!.x);
    expect(room!.warmth).toMatch(/^(Warm|Cold), −?\d+ °C · hearth lit$/);
    expect(room!.warmth).toContain(`${String(degrees).replace('-', '−')} °C`);
    // A room with no hearth says so, until the colony lays one.
    expect(says.some((t) => /^(Warm|Cold), −?\d+ °C · no hearth$/.test(t))).toBe(true);
  });
});
