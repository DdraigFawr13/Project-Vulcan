// The well (P5.2, V-131): people drink at the nearest unfrozen surface water or a well. Each
// drink is noted by the day and the tile (table `drink`: its walking minutes and drinks). Once a
// day the colony reads the last `well.days` days: when a person spends more than `well.walk`
// minutes a day walking to drink, or the water most drunk from has frozen, and no well stands or
// is planned, it plans one on the green beside the first hearth (`build.wellNeeded`). Builders
// make it of stone then logs (people/hearth.ts); `build.wellBuilt`. One well, never sent back,
// and it never freezes.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { raiseStock } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isFrozen } from '../weather/index.ts';
import { furnitureOf, piecesOf } from './furniture.ts';
import { HEARTH, openGround } from './hearths.ts';

export const WELL = 'well';

export const WELL_TABLES: Schemas = {
  /** One row a game day (`day`) and surface tile (`tile`, an index) drunk from: how many drinks
   * and the minutes walked to them. Rows older than `well.days` days are dropped. */
  drink: { day: 'int', tile: 'int', drinks: 'count', minutes: 'count' },
};

const rowsOf = (world: WorldState): EntityRow[] => world.entities['drink'] ?? [];
const dayOf = (world: WorldState): number => Math.floor(world.tick / TICKS_PER_DAY);

/** The wells standing. */
export const wellsOf = (world: WorldState): EntityRow[] => piecesOf(world, WELL);

const DRINKABLE = new WeakMap<object, number[]>();

/** The drinkable surface tiles, frozen or not (derived from the map, so cached by it). */
function drinkable(world: WorldState, content: EngineContent): number[] {
  const map = world.map;
  let tiles = DRINKABLE.get(map);
  if (!tiles) {
    tiles = [];
    for (let i = 0; i < map.tiles.length; i += 1)
      if (content.terrain.kinds[map.tiles[i]!]!.drinkable) tiles.push(i);
    DRINKABLE.set(map, tiles);
  }
  return tiles;
}

/** Where a person can drink now: the drinkable surface tiles that are not frozen, then the wells. */
export function waterSpots(world: WorldState, content: EngineContent): Spot[] {
  const map = world.map;
  const tiles = drinkable(world, content);
  const at = (i: number): Spot => ({ x: i % map.width, y: Math.floor(i / map.width), z: 0 });
  return [
    ...tiles.filter((i) => !isFrozen(map, i)).map(at),
    ...wellsOf(world).map((w) => ({ x: w['x'] as number, y: w['y'] as number, z: 0 })),
  ];
}

/** Notes a drink at surface tile `tile` after `minutes` of walking to it. */
export function noteDrink(world: WorldState, tile: number, minutes: number): void {
  const day = dayOf(world);
  const row = rowsOf(world).find((r) => r['day'] === day && r['tile'] === tile);
  if (row)
    Object.assign(row, {
      drinks: (row['drinks'] as number) + 1,
      minutes: (row['minutes'] as number) + minutes,
    });
  else addEntity(world, 'drink', { day, tile, drinks: 1, minutes });
}

/** The drinkable surface tile nearest `at` (rings outwards, tile order within one), frozen or not. */
function nearestDrinkable(world: WorldState, content: EngineContent, at: Spot): number | undefined {
  let best: number | undefined;
  let far = Infinity;
  for (const i of drinkable(world, content)) {
    const d = Math.max(
      Math.abs((i % world.map.width) - at.x),
      Math.abs(Math.floor(i / world.map.width) - at.y),
    );
    if (d < far) [best, far] = [i, d];
  }
  return best;
}

/** Why a well is wanted, or undefined: the walks there and back are long, or the water they drank
 * from most, or the water nearest the green, froze. */
function whyWanted(ctx: SystemContext, days: number, green: Spot): string | undefined {
  const { world, content } = ctx;
  const dial = content.buildings.well;
  const map = world.map;
  const rows = rowsOf(world);
  const alive = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive').length;
  // The rows count the walk there; the walk back is as long.
  const minutes = 2 * rows.reduce((n, r) => n + (r['minutes'] as number), 0);
  if (days >= dial.from && alive && minutes > dial.walk * days * alive)
    return `each person walks ${Math.round(minutes / days / alive)} minutes a day to drink and back`;
  const drunk = new Map<number, number>();
  for (const r of rows)
    drunk.set(r['tile'] as number, (drunk.get(r['tile'] as number) ?? 0) + (r['drinks'] as number));
  let best = -1;
  for (const [tile, n] of drunk)
    if (best < 0 || n > drunk.get(best)! || (n === drunk.get(best) && tile < best)) best = tile;
  const near = nearestDrinkable(world, content, green);
  const frozen =
    best >= 0 && isFrozen(map, best) ? best : near !== undefined && isFrozen(map, near) ? near : -1;
  if (frozen < 0) return undefined;
  const name = content.terrain.kinds[map.tiles[frozen]!]!.name;
  const which = frozen === best ? 'the water they drank from most' : 'the water nearest the green';
  return `the ${name} at ${frozen % map.width}, ${Math.floor(frozen / map.width)} froze, and it was ${which}`;
}

/** The free tile nearest the first hearth (else the green) within `well.near`, reachable from the green. */
function siteOf(ctx: SystemContext, green: Spot): Spot | undefined {
  const { world, content } = ctx;
  const hearth = furnitureOf(world)
    .filter((f) => f['kind'] === HEARTH)
    .sort((a, b) => a.id - b.id)[0];
  const c = hearth ? { x: hearth['x'] as number, y: hearth['y'] as number } : green;
  for (let r = 1; r <= content.buildings.well.near; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const [x, y] = [c.x + dx, c.y + dy];
        if (openGround(world, content, x, y) && canReach(content, world.map, green, { x, y, z: 0 }))
          return { x, y, z: 0 };
      }
  return undefined;
}

/** Hourly, once a day: drops old drink rows and plans the one well when the water is far. */
export function planWell(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  const day = dayOf(world);
  if (state['wellDay'] === day + 1) return;
  state['wellDay'] = day + 1;
  const dial = content.buildings.well;
  for (const r of rowsOf(world).filter((x) => (x['day'] as number) < day - dial.days))
    removeEntity(world, 'drink', r.id);
  if (furnitureOf(world).some((f) => f['kind'] === WELL)) return;
  const why = whyWanted(ctx, Math.min(dial.days, day), green);
  if (!why) return;
  const at = siteOf(ctx, green);
  if (!at) return;
  const kind = content.buildings.furniture.kinds.find((k) => k.id === dial.kind)!;
  const spell = world.systems['weather']?.['spell'] || world.begunEvent;
  const line = ctx.emit('build.wellNeeded', { causes: [spell as number], data: { why } });
  addEntity(world, 'furniture', {
    ...{ kind: kind.id, x: at.x, y: at.y, z: 0, facing: 's', quality: 0, maker: 0 },
    ...{ owner: 0, made: 0, line, state: 'plan', have: 0, work: -1, waited: 0 },
  });
  raiseStock(ctx, kind.material ?? content.buildings.furniture.material, kind.name, line);
  if (kind.also) raiseStock(ctx, kind.also.material, kind.name, line);
}

/** The last stroke: the well stands (the builder's line cites their taking it up and the plan). */
export function buildWell(ctx: SystemContext, p: EntityRow, piece: EntityRow): void {
  const made = ctx.emit('build.wellBuilt', {
    causes: [p['took'] as number, piece['line'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string },
  });
  Object.assign(piece, { state: 'built', maker: p.id, made, work: 0, waited: 0 });
}
