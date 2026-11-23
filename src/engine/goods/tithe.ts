// The lord's tithe in goods (6C Slice 2, V-222): what has been brought in since the reeve last
// came, kind by kind, and what lies in the tithe barn. The lord system says how much is due to be
// carried (`due`, from the Lord law and the lord's temper) and who may carry it (`by`); haulers
// carry it into the barn (band tithehaul.ts). The barn's goods are no longer items, so nobody eats,
// cooks or works them, and the store's counts leave them out.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';

export const TITHE_TABLES: Schemas = {
  /** One row a tithed kind: brought in since the reeve's last visit, still to carry to the barn,
   * carried (or on the way) since then, in the barn now, who may carry it (none named: anyone),
   * who is on the way to fetch some, and the lines it was brought in by (the latest `MOST`). */
  tithe: {
    ...{ kind: 'text', brought: 'count', due: 'count', set: 'count', barn: 'count' },
    ...{ by: 'ints', going: 'ints', lines: 'events' },
  },
  /** Goods taken from the barn and hidden (engine defy): the stash item, whose it is, what and how
   * many, and the line it was taken on. The reeve's search looks for these (engine lord). */
  hidden: { item: 'entity', person: 'entity', kind: 'text', count: 'count', line: 'event' },
};

export const hiddenOf = (world: WorldState): EntityRow[] => world.entities['hidden'] ?? [];

/** How many bringing-in lines a row keeps for the reeve's line to cite. */
const MOST = 8;

export const titheRows = (world: WorldState): EntityRow[] => world.entities['tithe'] ?? [];

export const titheRow = (world: WorldState, kind: string): EntityRow | undefined =>
  titheRows(world).find((r) => r['kind'] === kind);

/** Whether the tithe has begun: the reeve has named the colony's lord. */
export const tithing = (world: WorldState): boolean => !!world.entities['lord']?.[0]?.['named'];

/** `count` of `kind` brought in by line `line` (a harvest, a shearing, a smelt, a smith's work):
 * counted towards the lord's share once the tithe has begun, if the kind is tithed. */
export function broughtIn(
  world: WorldState,
  content: EngineContent,
  kind: string,
  count: number,
  line: number,
): void {
  if (count <= 0 || !tithing(world) || !content.lord.tithe.kinds.includes(kind)) return;
  let row = titheRow(world, kind);
  if (!row) {
    const empty = { brought: 0, due: 0, set: 0, barn: 0, by: [], going: [], lines: [] };
    addEntity(world, 'tithe', { kind, ...empty });
    row = titheRow(world, kind)!;
  }
  row['brought'] = (row['brought'] as number) + count;
  row['lines'] = [...(row['lines'] as number[]), line].filter((l) => l > 0).slice(-MOST);
}

/** What lies in the tithe barn, kind by kind (the Stock sheet's reserved row, Slice 4). */
export const barnOf = (world: WorldState): { kind: string; count: number }[] =>
  titheRows(world)
    .filter((r) => (r['barn'] as number) > 0)
    .map((r) => ({ kind: r['kind'] as string, count: r['barn'] as number }));

/** Takes up to `count` of `kind` out of the barn; how many were there to take. */
export function fromBarn(world: WorldState, kind: string, count: number): number {
  const row = titheRow(world, kind);
  const n = Math.min(count, (row?.['barn'] as number | undefined) ?? 0);
  if (row && n > 0) row['barn'] = (row['barn'] as number) - n;
  return n;
}
