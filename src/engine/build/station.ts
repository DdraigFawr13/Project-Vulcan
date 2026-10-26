// Stations (Phase 4 Bundle 3, V-041, V-061): the smelter and the charcoal clamp's spot. Like a
// furniture piece a station blocks no one's way and leaves `map.built` alone; unlike one it is
// not in a room. The colony plans them from need (metalsite.ts); builders build the smelter
// (people/station.ts); burners and smelters work them (people/charcoal.ts, people/smelt.ts).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const STATION_TABLES: Schemas = {
  /** `kind`: `smelter` or `clamp`; (x, y, z) its top-left tile and `w` by `h` its size; `state`:
   * a smelter is `plan` then `built`, a clamp is `idle` or `lit`; `line`: the line that planned
   * it; `have`: stone brought to the smelter; `work`: minutes left once building has started, -1
   * before; `made`: the line saying it was built, 0 before; `lit`: the tick a clamp was lit;
   * `litLine`: the line saying so; `alert` and `waitFor`: the smelter's waiting alert and the
   * item it waits for. */
  station: {
    kind: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    w: 'count',
    h: 'count',
    state: 'text',
    line: 'event',
    have: 'count',
    work: 'int',
    made: 'event',
    lit: 'int',
    litLine: 'event',
    alert: 'event',
    waitFor: 'text',
  },
};

export const stationsOf = (world: WorldState): EntityRow[] => world.entities['station'] ?? [];

/** The first station of a kind (the colony keeps one smelter and one clamp). */
export const stationOf = (world: WorldState, kind: string): EntityRow | undefined =>
  stationsOf(world).find((s) => s['kind'] === kind);

/** The station standing on or planned over surface tile (x, y). */
export const stationAt = (world: WorldState, x: number, y: number): EntityRow | undefined =>
  stationsOf(world).find(
    (s) =>
      s['z'] === 0 &&
      x >= (s['x'] as number) &&
      x < (s['x'] as number) + (s['w'] as number) &&
      y >= (s['y'] as number) &&
      y < (s['y'] as number) + (s['h'] as number),
  );

/** Every tile (as `y * width + x`) the stations cover. */
export const stationTiles = (world: WorldState): number[] =>
  stationsOf(world).flatMap((s) => {
    const out: number[] = [];
    for (let dy = 0; dy < (s['h'] as number); dy += 1)
      for (let dx = 0; dx < (s['w'] as number); dx += 1)
        out.push(((s['y'] as number) + dy) * world.map.width + (s['x'] as number) + dx);
    return out;
  });

/** A station's size in tiles, from content: the clamp is the workplace of the charcoal job, the
 * smokehouse of the curing job, the kiln of the potter's. */
export const sizeOfStation = (content: EngineContent, kind: string): number => {
  const place = (job: string) => content.jobs.find((j) => j.id === job)?.workplace;
  if (kind === place(content.work.cure.job)) return content.work.cure.house.size;
  if (kind === place(content.work.potter.job)) return content.work.potter.kiln.size;
  return kind === place(content.metal.clamp.job)
    ? content.metal.clamp.size
    : content.metal.smelter.size;
};
