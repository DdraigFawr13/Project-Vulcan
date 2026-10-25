// Stores by kind (5B Bundle 1, V-129): the granary, the larder, the wood yard, the stone and ore
// yard, each a content kind listing its goods. The build system sites them from need and builds
// their edge (build/stores.ts); once built, the tiles inside are store tiles that take only their
// kind's goods. The home store (store.ts) keeps the rest, and what a full store cannot take.
import type { EngineContent, EntityRow, StoreKindDef, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const DEPOT_TABLES: Schemas = {
  /** A store of a kind (content `buildings.stores.kinds` id): its footprint (edge and inside),
   * `plan` until its edge stands, then `built`; the line that sited it, the one that built it and
   * when. */
  depot: {
    store: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    w: 'int',
    h: 'int',
    state: 'text',
    line: 'event',
    built: 'event',
    /** The tick it was built, 0 while planned. */
    builtTick: 'int',
  },
};

export const depotsOf = (world: WorldState): EntityRow[] => world.entities['depot'] ?? [];

/** Each item kind's store kind, worked out once per content. */
const kindCache = new WeakMap<EngineContent, Map<string, StoreKindDef>>();
export function storeKindOf(content: EngineContent, kind: string): StoreKindDef | undefined {
  let m = kindCache.get(content);
  if (!m) {
    m = new Map();
    for (const s of content.buildings.stores.kinds) for (const g of s.goods) m.set(g, s);
    kindCache.set(content, m);
  }
  return m.get(kind);
}

/** Whether (x, y) is on the depot's footprint, edge or inside. */
export const onDepot = (d: EntityRow, x: number, y: number): boolean =>
  x >= (d['x'] as number) &&
  y >= (d['y'] as number) &&
  x < (d['x'] as number) + (d['w'] as number) &&
  y < (d['y'] as number) + (d['h'] as number);

/** Whether (x, y) is inside the depot's edge, where its goods lie. */
export const insideDepot = (d: EntityRow, x: number, y: number): boolean =>
  x > (d['x'] as number) &&
  y > (d['y'] as number) &&
  x < (d['x'] as number) + (d['w'] as number) - 1 &&
  y < (d['y'] as number) + (d['h'] as number) - 1;

/** The built depot whose inside holds the tile, if any. */
export const depotAt = (
  world: WorldState,
  x: number,
  y: number,
  z: number,
): EntityRow | undefined =>
  z === 0 ? depotsOf(world).find((d) => d['state'] === 'built' && insideDepot(d, x, y)) : undefined;

/** The tiles inside a depot, as rows like the home store's. */
export function depotTiles(d: EntityRow): EntityRow[] {
  const out: EntityRow[] = [];
  for (let y = (d['y'] as number) + 1; y < (d['y'] as number) + (d['h'] as number) - 1; y += 1)
    for (let x = (d['x'] as number) + 1; x < (d['x'] as number) + (d['w'] as number) - 1; x += 1)
      out.push({ id: 0, x, y, z: 0 });
  return out;
}

/** The built depots that take an item kind. */
export const depotsFor = (world: WorldState, content: EngineContent, kind: string): EntityRow[] => {
  const s = storeKindOf(content, kind);
  return s ? depotsOf(world).filter((d) => d['state'] === 'built' && d['store'] === s.id) : [];
};
