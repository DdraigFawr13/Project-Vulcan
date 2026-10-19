import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  calendarSystem,
  createSim,
  createWorld,
  mapSystem,
  recordOf,
  regionSystem,
  step,
  TICKS_PER_DAY,
  WATER,
  weatherSystem,
} from '../index.ts';
import { strandedWater, waterNearStart } from './checks.ts';
import { reachableAround } from './features.ts';
import { MAP_SEEDS } from './seeds.ts';

// P1.1 done-when: every seed's start has buildable land, wood and stone within reach, on
// ground joined to the start (no range walls it off). P1.2: drinkable water near the start, and
// no river or stream ends inland (each reaches the map's edge or a lake). P1.4: a year of weather
// freezes still water on every seed and never a spring (Morgan, 2026-10-17), each frozen tile citing
// its ice line; aura spots keep
// clear of the edge and of each other, each of its own school. One world per seed serves all.
describe('surface map', () => {
  const sim = createSim(content);
  const need = content.terrain.generator.start;
  // A year of weather needs only the land, the calendar and the weather, not the colony's year.
  const weatherSim = createSim(content, [regionSystem, mapSystem, calendarSystem, weatherSystem]);
  // One world per seed for the tests that read it as made.
  const worlds = new Map<string, ReturnType<typeof createWorld>>();
  const worldOf = (seed: string) =>
    worlds.get(seed) ?? worlds.set(seed, createWorld(sim, seed)).get(seed)!;
  it.each(MAP_SEEDS)('seed %s starts with land, wood, stone and water nearby', (seed) => {
    const { map } = worldOf(seed);
    const near = reachableAround(
      content,
      map.tiles,
      map.features,
      map.width,
      map.height,
      need.radius,
    )(map.startX, map.startY);
    expect(near.buildable).toBeGreaterThanOrEqual(need.buildable);
    expect(near.wood).toBeGreaterThanOrEqual(need.wood);
    expect(near.stone).toBeGreaterThanOrEqual(need.stone);
    expect(waterNearStart(content, map, need.radius)).toBeGreaterThan(0);
    expect(strandedWater(map)).toBe(0);
    const aura = content.terrain.generator.aura;
    const surface = map.auraSpots;
    expect(surface.length).toBeGreaterThanOrEqual(1);
    expect(surface.length).toBeLessThanOrEqual(aura.count[1]!);
    expect(new Set(surface.map((s) => s.school)).size).toBe(surface.length);
    for (const s of surface) {
      expect(Math.min(s.x, s.y, map.width - 1 - s.x, map.height - 1 - s.y)).toBeGreaterThanOrEqual(
        aura.margin,
      );
    }
  });
  it.each(MAP_SEEDS)('seed %s freezes still water in a year, never a spring', (seed) => {
    const world = createWorld(weatherSim, seed);
    let mostFrozen = 0;
    for (let day = 0; day < 336; day += 1) {
      step(world, weatherSim, TICKS_PER_DAY);
      mostFrozen = Math.max(mostFrozen, world.systems['weather']!['frozen']!);
    }
    expect(mostFrozen).toBeGreaterThan(0);
    // Only lake tiles ever count frost, so a spring's count stays 0 all year.
    const spring = WATER.indexOf('spring');
    expect(world.map.ice.some((c, i) => c > 0 && world.map.water[i] === spring)).toBe(false);
    // A tile that froze or thawed cites the day's ice line, so the inspector can say since when.
    const ice = new Set(['weather.iceFormed', 'weather.frozenOver', 'weather.iceSpread']);
    const froze = [...world.map.ice].flatMap((c, i) =>
      c & 0x80 ? [world.map.tileCauses[i]!] : [],
    );
    // Those lines are older than the recent week by now, so they are kept as stubs for the tiles.
    expect(froze.every((id) => ice.has(recordOf(world, id)?.type ?? ''))).toBe(true);
    expect(world.map.tileCauses.every((id) => recordOf(world, id))).toBe(true);
  });

  // The green (V-083): the band's first choice is level-ish dry ground with water a short walk
  // off, says so in its line, and a second choice lies `apart` tiles away; the same seed made
  // with the first sent back starts there, with a line saying how far the band moved.
  const mapOnly = createSim(content, [regionSystem, mapSystem]);
  it.each(MAP_SEEDS)('seed %s chooses a green and a second spot to send it back to', (seed) => {
    const green = content.terrain.generator.start.green;
    const first = createWorld(mapOnly, seed);
    const line = first.log.find((e) => e.type === 'map.green')!;
    expect(line.causes).toEqual([first.log.find((e) => e.type === 'map.formed')!.id]);
    expect(line.data['ground']).toMatch(/^(level|gently sloping|sloping), (dry|mostly dry)$/);
    expect(first.systems['map']).toMatchObject({ look: 0, next: 1 });
    const again = createWorld(mapOnly, seed, 1);
    const moved = again.log.find((e) => e.type === 'map.greenAgain')!;
    const [dx, dy] = [again.map.startX - first.map.startX, again.map.startY - first.map.startY];
    expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeGreaterThanOrEqual(green.apart);
    expect(moved.data['tiles']).toBe(Math.max(Math.abs(dx), Math.abs(dy)));
    // Only the start differs: the land is the same valley.
    expect(again.map.tiles).toEqual(first.map.tiles);
  });
});
