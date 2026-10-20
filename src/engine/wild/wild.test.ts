// Phase 5 Bundle 2 (the wild valley): a valley has herds and one named pack; a winter with no
// kills makes the pack hungrier and says why; snow lies after a wet freezing day and melts after
// a warm one; an animal on lying snow leaves a print that is gone after a day; a killed animal
// leaves game, leftovers and offal with its line; a pack down to one leaves and may return.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  calendarSystem,
  createSim,
  createWorld,
  emit,
  itemsOf,
  mapSystem,
  removeEntity,
  step,
  streamFor,
  SYSTEMS,
  templatesOf,
  valleyOf,
  weatherSystem,
  type EngineContent,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { stepCost } from '../paths/index.ts';
import {
  animalsOf,
  herdsOf,
  huntable,
  killAnimal,
  packOf,
  predatorsNear,
  printsAt,
  spareCount,
} from './index.ts';

const DAY = 1440;
const lines = (w: WorldState, type: string) => allLines(w).filter((l) => l.type === type);
const typeOf = (w: WorldState, id: number) => allLines(w).find((l) => l.id === id)?.type;
const contextOf = (w: WorldState, c: EngineContent): SystemContext => ({
  world: w,
  content: c,
  state: w.systems['wild']!,
  rng: () => streamFor(w, 'wild'),
  emit: (type, fields) => emit(w, templatesOf(c.events), type, fields),
});

describe('the wild valley', () => {
  const sim = createSim(content);
  const world = createWorld(sim, 'anvil/1');
  const map = world.map;

  it('has herds on open ground far from the start and one pack named for a neighbour', () => {
    const herds = herdsOf(world);
    expect(herds.length).toBeGreaterThan(3);
    expect(new Set(herds.map((h) => h['species']))).toContain('deer');
    for (const h of herds) {
      const [x, y] = [h['x'] as number, h['y'] as number];
      expect(Math.max(Math.abs(x - map.startX), Math.abs(y - map.startY))).toBeGreaterThanOrEqual(
        content.wild.place.start,
      );
      expect(animalsOf(world).filter((a) => a['herd'] === h.id).length).toBe(h['start']);
    }
    const pack = packOf(world)!;
    const near = valleyOf(world.seed, content)!.valley.near[0]!.name;
    expect(pack['name']).toContain(near);
    expect(pack['size']).toBeGreaterThanOrEqual(4);
    const den = [pack['denX'] as number, pack['denY'] as number];
    expect(
      Math.max(Math.abs(den[0]! - map.startX), Math.abs(den[1]! - map.startY)),
    ).toBeGreaterThanOrEqual(content.wild.pack.den.from);
    const named = lines(world, 'wild.packNamed')[0]!;
    expect(named.data['name']).toBe(pack['name']);
    expect(typeOf(world, named.causes[0]!)).toBe('region.settled');
    expect(predatorsNear(world, den[0]!, den[1]!, 6).length).toBe(pack['size']);
    expect(spareCount(content)).toBe(3);
    const sizes = huntable(world, content).map(
      (h) => animalsOf(world).filter((a) => a['herd'] === h.id).length,
    );
    expect(sizes.every((n) => n > spareCount(content))).toBe(true);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('leaves a print on lying snow that is gone after a day', () => {
    const animal = animalsOf(world).find((a) => a['herd'])!;
    const [x, y] = [animal['x'] as number, animal['y'] as number];
    const from = y * map.width + x;
    const to = [from + 1, from - 1, from + map.width, from - map.width].find(
      (i) => stepCost(content, map, from, i) > 0 && !content.terrain.kinds[map.tiles[i]!]!.water,
    )!;
    map.snowLie[to] = 1;
    Object.assign(animal, { path: [to], state: '' });
    step(world, sim, 10);
    expect([animal['x'], animal['y']]).toEqual([to % map.width, Math.floor(to / map.width)]);
    expect(printsAt(world, content, to)).toMatchObject({ kind: 'hoof', ageHours: 0 });
    // The animal leaves the valley, so nothing treads the tile again.
    removeEntity(world, 'animal', animal.id);
    step(world, sim, 25 * 60);
    expect(printsAt(world, content, to)).toBeUndefined();
    step(world, sim, 2 * DAY);
    expect(map.printKind[to]).toBe(0);
  });

  it('lays game, leftovers and offal where an animal is killed, with the line', () => {
    const herd = herdsOf(world).find((h) => h['species'] === 'deer')!;
    const animal = animalsOf(world).find((a) => a['herd'] === herd.id)!;
    const before = animalsOf(world).length;
    const line = killAnimal(contextOf(world, content), animal, 0, world.begunEvent);
    expect(typeOf(world, line)).toBe('wild.killed');
    expect(animalsOf(world).length).toBe(before - 1);
    const made = itemsOf(world).filter((i) => i['made'] === line);
    const total = (kind: string) =>
      made.filter((i) => i['kind'] === kind).reduce((n, i) => n + (i['count'] as number), 0);
    expect(['game', 'hide', 'bone', 'fat', 'offal'].map(total)).toEqual([36, 1, 2, 1, 1]);
    expect(made.every((i) => i['owner'] === 0 && i['holder'] === 0)).toBe(true);
    const at = made.find((i) => i['kind'] === 'hide')!;
    expect([at['x'], at['y']]).toEqual([animal['x'], animal['y']]);
    const person = world.entities['person']![0]!;
    const next = animalsOf(world).find((a) => a['herd'] === herd.id)!;
    const byBand = killAnimal(contextOf(world, content), next, person.id, 0);
    expect(typeOf(world, byBand)).toBe('wild.killed');
    expect(herd['taken']).toBe(1);
  });
});

describe('a hard winter with nothing eaten', () => {
  // The pack finds no meal, in the valley or beyond it; every month is bitter.
  const hard: EngineContent = {
    ...content,
    seasons: { ...content.seasons, months: content.seasons.months.map(() => -12) },
    wild: {
      ...content.wild,
      pack: { ...content.wild.pack, offMap: 0, offMapWinter: 0, inValley: 0 },
    },
  };
  const sim = createSim(hard);

  it('raises hunger, writes hungry lines citing the spell then a low herd, and brings the pack to the edge', () => {
    const w = createWorld(sim, 'anvil/1');
    // With every herd whole, the first hungry line (day 7) cites the weather spell.
    step(w, sim, 8 * DAY);
    const first = lines(w, 'wild.packHungry')[0]!;
    expect(first.data['days']).toBe(7);
    expect(typeOf(w, first.causes[0]!)).toBe('weather.changed');
    // Drive one herd down to half: its low line is then what the next hungry line cites.
    const herd = herdsOf(w).find((h) => h['species'] === 'deer')!;
    const mine = animalsOf(w).filter((a) => a['herd'] === herd.id);
    for (const a of mine.slice(0, Math.ceil(mine.length / 2)))
      killAnimal(contextOf(w, hard), a, 0, 0);
    step(w, sim, 6 * DAY);
    const pack = packOf(w)!;
    expect(pack['hunger']).toBeGreaterThanOrEqual(13);
    const low = lines(w, 'wild.herdLow')[0]!;
    expect(low.data['species']).toBe('deer');
    const hungry = lines(w, 'wild.packHungry');
    expect(hungry.map((l) => l.data['days'])).toEqual([7, 10, 13]);
    expect(hungry[1]!.causes).toEqual([low.id]);
    expect(hungry[1]!.data['left']).toMatch(/^The deer .* are down to \d+$/);
    expect(Object.values(hard.wild.pack.why)).toContain(hungry[1]!.data['why']);
    // Past 12 days hungry, the pack came to the edge of town by night, citing the hungry line.
    const edge = lines(w, 'wild.packAtEdge');
    expect(edge.length).toBeGreaterThan(0);
    expect(typeOf(w, edge[0]!.causes[0]!)).toBe('wild.packHungry');
    expect(pack['visits']).toBeGreaterThan(0);
  });
});

describe('lying snow', () => {
  const systems = [mapSystem, calendarSystem, weatherSystem];
  const weather = (months: number, wet: number): EngineContent => ({
    ...content,
    seasons: {
      ...content.seasons,
      months: content.seasons.months.map(() => months),
      kinds: content.seasons.kinds.map((k) => ({ ...k, wet })),
    },
  });
  const cold = createSim(weather(-20, 1), systems);
  const warm = createSim(weather(25, 0), systems);

  it('lies after a wet freezing day and melts after a warm one, each with a line citing the spell', () => {
    const w = createWorld(cold, 'anvil');
    const snowy = () => w.map.snowLie.reduce((n, s) => n + s, 0);
    expect(snowy()).toBe(0);
    step(w, cold, 2 * DAY);
    expect(snowy()).toBeGreaterThan(w.map.tiles.length / 10);
    const settled = lines(w, 'weather.snowSettled');
    expect(settled).toHaveLength(1);
    expect(typeOf(w, settled[0]!.causes[0]!)).toBe('weather.changed');
    // Water never takes snow.
    expect(
      w.map.tiles.every((t, i) => !content.terrain.kinds[t]!.water || w.map.snowLie[i] === 0),
    ).toBe(true);
    step(w, warm, 2 * DAY);
    expect(snowy()).toBe(0);
    expect(lines(w, 'weather.snowMelted')).toHaveLength(1);
  });
});

describe('a pack down to one', () => {
  const back: EngineContent = {
    ...content,
    wild: {
      ...content.wild,
      pack: { ...content.wild.pack, returns: { month: 'Seedmonth', chance: 1 } },
    },
  };
  const sim = createSim(back, SYSTEMS);

  it('leaves with a line and a new pack takes the range the month it may return', () => {
    const w = createWorld(sim, 'tallow/1');
    const pack = packOf(w)!;
    const old = pack['name'];
    for (const a of animalsOf(w)
      .filter((a) => a['pack'])
      .slice(1))
      killAnimal(contextOf(w, back), a, 0, 0);
    step(w, sim, 2 * DAY);
    expect(packOf(w)).toBeUndefined();
    const left = lines(w, 'wild.packLeft');
    expect(left).toHaveLength(1);
    expect(left[0]!.data['name']).toBe(old);
    step(w, sim, 28 * DAY);
    const again = lines(w, 'wild.packNamed')[1]!;
    expect(again.causes).toEqual([left[0]!.id]);
    expect(packOf(w)!['size']).toBeGreaterThanOrEqual(4);
  });
});
