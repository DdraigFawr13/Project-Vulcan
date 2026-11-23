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

  it('names on the Scouting row each ore wanted with no seam known, and how long (V-227)', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 60);
    expect(scoutingWords(w)).toBe('nobody out; no trip yet');
    w.systems['orewant'] = { copper: w.tick - 40 * TICKS_PER_DAY, 'l-copper': w.tick };
    expect(scoutingWords(w)).toBe('nobody out; no trip yet; copper wanted 40 days');
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

    // A week on, the trip's days are sealed: the find keeps its line and the trip its time out.
    const found = map.finds.find((f) => f.line === told)!;
    step(w, sim, 8 * TICKS_PER_DAY);
    expect(w.log.some((e) => e.id === told)).toBe(false);
    expect(tileFind(w, 10, 12, line(w)).find?.line?.id).toBe(told);
    const later = tripsView(w, line(w)).trips.at(map.finds.length - 1 - map.finds.indexOf(found));
    expect(later?.sub).toMatch(/^Out 20 hours.* · told of a wood$/);
  });

  it('flags a found place and a beyond trip says what it found', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 60);
    const { map } = w;
    const scout = w.entities['person']![0]!;
    const name = scout['name'] as string;
    // A spring the scout found on a trip to see what lies beyond.
    const place = map.places.find((p) => p.kind === 'spring' && !p.line)!;
    expect(place).toBeDefined();
    const setOut = emit(w, sim.templates, 'work.tookUpScoutingBeyond', {
      actors: [scout.id],
      data: { name, kit: '', days: 84 },
    });
    const trip = { x: place.x, y: place.y, good: 'beyond', count: -1, who: scout.id, line: setOut };
    map.finds.push({
      ...trip,
      tick: w.tick,
      due: w.tick + TICKS_PER_DAY,
      worry: 0,
      searcher: 0,
      search: 0,
      strayed: 0,
    });
    expect(scoutingWords(w)).toMatch(new RegExp(`^${name} is out to see what lies beyond, due`));
    w.tick += 600; // the clock only
    const found = emit(w, sim.templates, 'land.found', {
      causes: [setOut],
      actors: [scout.id],
      data: {
        name,
        what: 'a spring',
        far: 30,
        dir: 'east',
        magic: '',
        then: 'Fresh water.',
        sort: 'place',
      },
    });
    Object.assign(place, { by: scout.id, line: found, tick: w.tick });
    const home = emit(w, sim.templates, 'land.beyond', {
      causes: [setOut],
      actors: [scout.id],
      data: { name, far: 30, dir: 'east', found: 'a spring' },
    });
    Object.assign(map.finds.at(-1)!, { count: 0, line: home, tick: w.tick });

    const i = place.y * map.width + place.x;
    map.known[i] = 0;
    expect(findMarks(w)).not.toContainEqual({ x: place.x, y: place.y });
    map.known[i] = 1;
    expect(findMarks(w)).toContainEqual({ x: place.x, y: place.y });
    const page = tileFind(w, place.x, place.y, line(w)).find!;
    expect(page.title).toBe('A spring');
    expect(page.rows).toEqual([
      ['find', expect.stringMatching(/^a spring, \d+ tiles [a-z-]+ of home$/)],
      ['found by', name],
      ['when', expect.stringMatching(/^\d\d:\d\d, Day/)],
      ['seen', 'Fresh water to drink and camp by.'],
    ]);
    expect(page.line?.id).toBe(found);

    const [t] = tripsView(w, line(w)).trips;
    expect(t).toMatchObject({ title: `${name}, to see what lies beyond · home` });
    expect(t!.sub).toMatch(/· found a spring$/);
    expect(t!.lines.map((l) => [l.id, l.at])).toEqual([
      [setOut, undefined],
      [found, { x: place.x, y: place.y }],
      [home, undefined],
    ]);
  });
});
