// Furniture (P3.4, P3.5): the pieces colonists make at a bench and set in rooms. A piece is a row:
// planned (`plan`) while a carpenter fetches the wood and works it, then built, with a quality
// score, its maker and, for a bed, its owner. A piece is not a wall: it blocks no one's way and
// `map.built` is untouched; the spot is only kept free of other pieces and of the door's way in
// (wants.ts). Rooms count built pieces for beds and beauty (rooms.ts).
import type { EngineContent, EntityRow, FurnitureKind, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const FURNITURE_TABLES: Schemas = {
  /** `kind`: a buildings.json furniture id; (x, y, z) its tile, set when planned; `facing`: `n`,
   * `e`, `s`, `w` (a bed `v` or `h`); `quality`: the score, from the maker's crafting level and
   * a roll (0 until made); `maker`: who made it (0 until made); `owner`: whose bed it is, 0 if
   * free; `made`: the line saying it was made, 0 before; `line`: the line that planned it (the
   * bench) or the maker's taking it up; `state`: `plan` or `built`; `have`: wood brought so far;
   * `work`: minutes left once work has started, -1 before; `waited`: the line saying its wood
   * cannot be reached, 0 when not. */
  furniture: {
    kind: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    facing: 'text',
    quality: 'int',
    maker: 'entity',
    owner: 'entity',
    made: 'event',
    line: 'event',
    state: 'text',
    have: 'count',
    work: 'int',
    waited: 'event',
  },
};

export const furnitureOf = (world: WorldState): EntityRow[] => world.entities['furniture'] ?? [];

/** The pieces made and standing (not planned), optionally of one kind. */
export const piecesOf = (world: WorldState, kind?: string): EntityRow[] =>
  furnitureOf(world).filter((f) => f['state'] === 'built' && (!kind || f['kind'] === kind));

export const kindOf = (content: EngineContent, piece: EntityRow): FurnitureKind =>
  content.buildings.furniture.kinds.find((k) => k.id === piece['kind'])!;

/** The quality word for a score: the first (highest) step it reaches. */
export function qualityOf(content: EngineContent, score: number) {
  const steps = content.buildings.furniture.quality;
  return steps.find((q) => score >= q.at) ?? steps[steps.length - 1]!;
}

/** The standing bench, if there is one. */
export const benchOf = (world: WorldState): EntityRow | undefined => piecesOf(world, 'bench')[0];

/** Any bench row, planned or built: the colony sets up one at a time. */
export const anyBench = (world: WorldState): EntityRow | undefined =>
  furnitureOf(world).find((f) => f['kind'] === 'bench');

/** The piece (planned or built) on surface tile (x, y), if any. */
export const pieceAt = (world: WorldState, x: number, y: number): EntityRow | undefined =>
  furnitureOf(world).find((f) => f['x'] === x && f['y'] === y && f['z'] === 0);

/** The built bed that is `owner`'s, if they have one. */
export const bedOwnedBy = (world: WorldState, owner: number): EntityRow | undefined =>
  piecesOf(world, 'bed').find((f) => f['owner'] === owner);

/** What a piece of `kind` still lacks with `have` brought: the material to fetch next and how much
 * of it (a kind with `also` takes its first material, then the second, counted in one `have`). */
export function furnitureLacks(content: EngineContent, kind: FurnitureKind, have: number) {
  if (!kind.also || have < kind.cost)
    return {
      material: kind.material ?? content.buildings.furniture.material,
      need: Math.max(0, kind.cost - have),
    };
  return { material: kind.also.material, need: Math.max(0, kind.cost + kind.also.cost - have) };
}
