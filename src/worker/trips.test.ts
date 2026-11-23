// The known map's views (6W Slice 6, V-213): unseen surface goes to the screen as bare land and
// its page says only "not yet seen"; a scout's find gets a flag and a page; the Trips tab and the
// Scouting row say who is out and what each trip came to. The trip's lines are written here with
// `emit` as the engine writes them (scout.ts, camp.ts), so this tests the views, not the trips.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  chunkTiles,
  CHUNK,
  createSim,
  createWorld,
  emit,
  entityOf,
  step,
  TICKS_PER_DAY,
  type SimEvent,
  type Stub,
} from '../engine/index.ts';
import { findMarks, knownFeed, tileFind } from './finds.ts';
import { lineOf } from './lines.ts';
import { scoutingWords, tripsView } from './trips.ts';
import { tileView } from './views.ts';

const sim = createSim(content);
const line = (w: ReturnType<typeof createWorld>) => (e: SimEvent | Stub) => lineOf(w, sim, e);

describe('the known map on screen', () => {
  it('sends unseen surface as bare land, pages it as not yet seen, and resends it once seen', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 60);
    const { map } = w;
    // An unseen tile with something growing on it.
    const i = map.known.findIndex((k, n) => k !== 1 && map.features[n]! > 0);
    expect(i).toBeGreaterThanOrEqual(0);
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const c = chunkTiles(map, Math.floor(x / CHUNK), Math.floor(y / CHUNK));
    const at = (y - c.y) * c.w + (x - c.x);
    expect([c.known[at], c.features[at], c.tiles[at]]).toEqual([0, 0, map.tiles[i]]);
    const page = tileView(w, x, y, 0, line(w))!;
    expect(page).toMatchObject({ ground: 'not yet seen', unseen: true });
    expect(page.biome ?? page.feature ?? page.elevation).toBeUndefined();

    const feed = knownFeed();
    feed.grown(map, w.tick);
    map.known[i] = 1;
    const chunk = Math.floor(y / CHUNK) * Math.ceil(map.width / CHUNK) + Math.floor(x / CHUNK);
    expect([...feed.grown(map, w.tick + 1)]).toEqual([chunk]);
    expect(chunkTiles(map, Math.floor(x / CHUNK), Math.floor(y / CHUNK)).features[at]).toBe(
      map.features[i],
    );
  });

  it('flags a find, pages it, and tells the trip in the Trips tab and the Scouting row', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 60);
    const { map } = w;
    const scout = w.entities['person']![0]!;
    const name = scout['name'] as string;
    expect(scoutingWords(w)).toBe('nobody out; no trip yet');
    expect(tripsView(w, line(w))).toMatchObject({ trips: [] });

    const setOut = emit(w, sim.templates, 'work.tookUpScouting', {
      actors: [scout.id],
      data: { name, good: 'wood', kit: '', have: 3, want: 50 },
    });
    const due = w.tick + TICKS_PER_DAY;
    const trip = { x: 10, y: 12, good: 'logs', count: -1, who: scout.id, line: setOut };
    map.finds.push({ ...trip, tick: w.tick, due, worry: 0, searcher: 0, search: 0, strayed: 0 });
    expect(scoutingWords(w)).toMatch(
      new RegExp(`^${name} is out for wood, due home \\d\\d:\\d\\d, Day`),
    );
    expect(tripsView(w, line(w)).trips[0]).toMatchObject({ title: `${name}, for wood · out` });

    w.tick += 600; // the clock only: a real step would end this written trip
    const camp = emit(w, sim.templates, 'land.camped', {
      causes: [setOut],
      actors: [scout.id],
      data: { name, far: 30, dir: 'north', fire: '', x: 9, y: 11 },
    });
    w.tick += 600; // the clock only: a real step would end this written trip
    const told = emit(w, sim.templates, 'land.toldOf', {
      causes: [setOut],
      actors: [scout.id],
      data: { name, find: 'a wood', far: 30, dir: 'north', count: 40, unit: 'trees' },
    });
    Object.assign(map.finds.at(-1)!, { count: 40, line: told, tick: w.tick });
    // Seen ground only is flagged (V-213).
    expect(findMarks(w)).toEqual([]);
    for (let yy = 0; yy < 25; yy += 1)
      for (let xx = 0; xx < 25; xx += 1) map.known[yy * map.width + xx] = 1;
    expect(findMarks(w)).toEqual([{ x: 10, y: 12 }]);

    const page = tileFind(w, 10, 12, line(w)).find!;
    expect(page.title).toBe('A wood');
    expect(page.rows.map(([k]) => k)).toEqual(['find', 'found by', 'when', 'worked']);
    expect(page.rows[0]![1]).toMatch(/^a wood, about 40 trees, \d+ tiles [a-z-]+ of home$/);
    expect(page.rows[1]![1]).toBe(`${name}, scouting for wood`);
    expect(page.line?.id).toBe(told);
    expect(tileFind(w, 11, 12, line(w)).find).toBeUndefined();

    const view = tripsView(w, line(w));
    expect(view.head).toMatch(/^Nobody is out\. A scout goes when the wood, stone or food/);
    const [t] = view.trips;
    expect(t).toMatchObject({
      title: `${name}, for wood · home`,
      sub: 'Out 20 hours, 1 night camped · told of a wood',
    });
    expect(t!.lines.map((l) => [l.id, l.at])).toEqual([
      [setOut, undefined],
      [camp, { x: 9, y: 11 }],
      [told, { x: 10, y: 12 }],
    ]);
    expect(scoutingWords(w)).toBe('nobody out; last trip home today');
    w.tick += 2 * TICKS_PER_DAY;
    expect(scoutingWords(w)).toBe('nobody out; last trip home 2 days ago');
    expect(entityOf(w, 'person', scout.id)).toBeDefined();
  });
});
