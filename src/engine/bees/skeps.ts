// The skep stand (P5.13, V-135): once a field stands the colony wants skeps at its edge, on the side
// nearest the woods, for the swarms that come out of them. Nobody places them: the bees system
// sites the stand (`siteStand`, scored never drawn: the nearest tree, then the free run of tiles
// nearest the middle of the side), and a beekeeper (people/beekeep.ts) makes, tends and robs them.
import {
  clockAt,
  streamFor,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { fieldsOf, fieldTiles, groundOf, housesOf, rectOf, roadAt } from '../build/index.ts';
import { inRect } from '../build/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const BEES_TABLES: Schemas = {
  /** A skep by a field. `state`: `plan` (to be made), `empty` (made, no bees) or `bees`. `line` is
   * its latest line, `harvested` the year it was last robbed (0 none), `visited` the day number
   * a beekeeper last looked for a swarm in it. */
  skep: {
    x: 'int',
    y: 'int',
    z: 'int',
    field: 'entity',
    state: 'text',
    line: 'event',
    harvested: 'count',
    visited: 'int',
  },
};

export const skepsOf = (world: WorldState): EntityRow[] => world.entities['skep'] ?? [];

const monthName = (world: WorldState, content: EngineContent): string =>
  content.calendar.monthNames[clockAt(world.tick, content.calendar).month] ?? '';

/** Whether this is a month a swarm may come in. */
export const swarmNow = (world: WorldState, content: EngineContent): boolean =>
  content.lamp.bees.swarm.months.includes(monthName(world, content));

/** Whether skeps are sited and made this month (`skep.months`: the spring before the swarms, so
 * a new colony's first weeks go to shelter and food). */
export const skepNow = (world: WorldState, content: EngineContent): boolean =>
  content.lamp.bees.skep.months.includes(monthName(world, content));

/** Whether this is the month the honey is taken. */
export const harvestNow = (world: WorldState, content: EngineContent): boolean =>
  monthName(world, content) === content.lamp.bees.harvest.month;

/** The colony's year and the day number now. */
export const yearNow = (world: WorldState, content: EngineContent): number =>
  clockAt(world.tick, content.calendar).year;
export const dayNow = (world: WorldState): number => Math.floor(world.tick / 1440);

/** Whether a swarm is caught on this visit: `swarm.chance` per cent, from the `bees` stream. */
export const swarmComes = (world: WorldState, content: EngineContent): boolean =>
  streamFor(world, 'bees').int(100) < content.lamp.bees.swarm.chance;

const SIDES = ['north', 'east', 'south', 'west'] as const;
type Side = (typeof SIDES)[number];

/** The sides of the field's box that have a tree within `woods` tiles, nearest first (ties in
 * the order north, east, south, west). */
function woodsSides(
  world: WorldState,
  content: EngineContent,
  box: { x0: number; y0: number; x1: number; y1: number },
): Side[] {
  const { woods } = content.lamp.bees;
  const map = world.map;
  const near = new Map<Side, number>();
  for (let y = Math.max(0, box.y0 - woods); y <= Math.min(map.height - 1, box.y1 + woods); y += 1)
    for (
      let x = Math.max(0, box.x0 - woods);
      x <= Math.min(map.width - 1, box.x1 + woods);
      x += 1
    ) {
      const f = map.features[y * map.width + x]!;
      if (!f || content.features[f - 1]!.kind !== 'tree') continue;
      const dx = x < box.x0 ? x - box.x0 : x > box.x1 ? x - box.x1 : 0;
      const dy = y < box.y0 ? y - box.y0 : y > box.y1 ? y - box.y1 : 0;
      if (!dx && !dy) continue;
      const side: Side =
        Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : dy < 0 ? 'north' : 'south';
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d <= woods && d < (near.get(side) ?? Infinity)) near.set(side, d);
    }
  return SIDES.filter((s) => near.has(s)).sort((a, b) => near.get(a)! - near.get(b)!);
}

/** The first free run of `stand` tiles along a side of the box, a row or two out from the field,
 * with the run nearest the middle of the side first. */
function runAlong(
  ctx: SystemContext,
  box: { x0: number; y0: number; x1: number; y1: number },
  side: Side,
): number[] | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const { stand } = content.lamp.bees;
  const ground = groundOf(world);
  const houses = housesOf(world).map(rectOf);
  const free = (x: number, y: number): boolean => {
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return false;
    const i = y * map.width + x;
    const kind = content.terrain.kinds[map.tiles[i]!]!;
    if (!kind.buildable || kind.water || kind.solid || map.built[i] || map.features[i])
      return false;
    if (ground.taken.has(i) || ground.items.has(i) || roadAt(world, i)) return false;
    return (
      !houses.some((r) => inRect(r, x, y)) &&
      !skepsOf(world).some((s) => s['x'] === x && s['y'] === y)
    );
  };
  const across = side === 'north' || side === 'south';
  const [lo, hi] = across ? [box.x0 - 1, box.x1 + 1] : [box.y0 - 1, box.y1 + 1];
  const mid = (lo + hi) / 2;
  for (const away of [1, 2]) {
    const line = across
      ? side === 'north'
        ? box.y0 - away
        : box.y1 + away
      : side === 'west'
        ? box.x0 - away
        : box.x1 + away;
    const runs: { from: number; tiles: number[] }[] = [];
    for (let from = lo; from + stand - 1 <= hi; from += 1) {
      const tiles = Array.from({ length: stand }, (_, k) => from + k);
      const at = (c: number) => (across ? [c, line] : [line, c]) as [number, number];
      if (tiles.every((c) => free(...at(c))))
        runs.push({ from, tiles: tiles.map((c) => at(c)[1] * map.width + at(c)[0]) });
    }
    runs.sort(
      (a, b) => Math.abs(a.from + (stand - 1) / 2 - mid) - Math.abs(b.from + (stand - 1) / 2 - mid),
    );
    if (runs[0]) return runs[0].tiles;
  }
  return undefined;
}

/** Daily: with a field standing and no skeps yet, sites the stand on the woodward side of the
 * field (`bees.sited`, citing the field's line); with nothing fitting, no line and again tomorrow. */
export function siteStand(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (skepsOf(world).length || !skepNow(world, content)) return;
  const field = fieldsOf(world).find((f) =>
    ['sown', 'ripe', 'fallow'].includes(f['state'] as string),
  );
  if (!field) return;
  const w = world.map.width;
  const tiles = fieldTiles(field);
  const xs = tiles.map((i) => i % w);
  const ys = tiles.map((i) => Math.floor(i / w));
  const box = {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
  for (const side of woodsSides(world, content, box)) {
    const run = runAlong(ctx, box, side);
    if (!run) continue;
    const why = `flowers on the field for the bees, and the woods ${side} for swarms`;
    const line = ctx.emit('bees.sited', {
      causes: [field['line'] as number],
      data: { field: 'field', why },
    });
    for (const i of run)
      addEntity(world, 'skep', {
        ...{ x: i % w, y: Math.floor(i / w), z: 0, field: field.id, state: 'plan', line },
        ...{ harvested: 0, visited: 0 },
      });
    return;
  }
}
