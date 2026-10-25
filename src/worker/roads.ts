// Worn ground and roads for the screens (P5.10): the Build sheet's Roads row and a tile's worn and
// road rows, in words from the engine's answers. Pure reads (MODULE.md).
import { content } from '../content/index.ts';
import {
  buildWantOf,
  haveOf,
  nextRoad,
  recordOf,
  roadAt,
  roadsOf,
  walksADay,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { RoadsRow } from './protocol-build.ts';
import type { TileView } from './protocol.ts';
import { clockView } from './views.ts';

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

const part = () => content.buildings.parts.find((p) => p.id === content.buildings.roads.part)!;

const why = (r: EntityRow): string =>
  `the most worn stretch of the way from ${r['from'] as string} to ${r['to'] as string}, walked about ${plural(r['walks'] as number, 'time')} a day`;

/** The Roads row of the Build sheet. */
export function roadsRow(world: WorldState): RoadsRow {
  const level = buildWantOf(world, content, 'road').level;
  const road = part();
  const most = content.buildings.roads.stretch;
  const have = haveOf(world, content, road.material);
  const next = nextRoad(world);
  const built = world.map.built;
  const index = content.buildings.parts.indexOf(road) + 1;
  return {
    want: { level, word: content.work.priority.words[level - 1] ?? '' },
    ...(next && {
      worn: `${next['from'] as string} to ${next['to'] as string}, walked about ${plural(next['walks'] as number, 'time')} a day`,
    }),
    stone: `A stretch of up to ${most} tiles takes ${most * road.cost} ${road.material}; ${have} in store.`,
    roads: roadsOf(world)
      .filter((r) => r['state'] !== 'next')
      .map((r) => {
        const tiles = r['tiles'] as number[];
        return {
          id: r.id,
          from: r['from'] as string,
          to: r['to'] as string,
          tiles: tiles.length,
          state: r['state'] as string,
          done: tiles.filter((i) => built[i] === index).length,
          why: why(r),
        };
      }),
  };
}

/** A tile's worn and road rows, surface tile `i`. */
export function tileRoad(world: WorldState, i: number): Partial<TileView> {
  const map = world.map;
  const road = roadAt(world, i);
  const kind = content.terrain.kinds[map.tiles[i]!]!.id;
  const stage = map.worn[i]!;
  const wears = content.terrain.wear.kinds.includes(kind);
  const laid = road && road['laid'] ? recordOf(world, road['laid'] as number) : undefined;
  const at = laid && 'tick' in laid ? clockView(laid.tick) : undefined;
  return {
    ...(stage > 0 &&
      wears &&
      !road && {
        worn: `${content.terrain.wear.words[stage - 1] ?? ''}, walked about ${plural(walksADay(content, map.wear[i]!), 'time')} a day`,
      }),
    ...(road && {
      road: at
        ? `${road['from'] as string} to ${road['to'] as string}, laid Day ${at.day} of ${at.monthName}`
        : `being laid; why here: ${why(road)}`,
    }),
  };
}
