// The lord's tithe in goods (6C Slice 2, V-222): what has been brought in since the reeve last
// came, kind by kind, and what lies in the tithe barn. The lord system says how much is due to be
// carried (`due`, from the Lord law and the lord's temper) and who may carry it (`by`); haulers
// carry it into the barn (band tithehaul.ts). The barn's goods are no longer items, so nobody eats,
// cooks or works them, and the store's counts leave them out.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { apartOf, dropAsk, fromAsks } from './asks.ts';

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

/** What lies in the tithe barn, kind by kind (the Stock sheet's reserved row, Slice 4): the
 * lord's share and what is set apart for asks (Slice 3). */
export function barnOf(world: WorldState): { kind: string; count: number }[] {
  const all = apartOf(world);
  for (const r of titheRows(world)) {
    const k = r['kind'] as string;
    all.set(k, (all.get(k) ?? 0) + (r['barn'] as number));
  }
  return [...all].filter(([, n]) => n > 0).map(([kind, count]) => ({ kind, count }));
}

/** A `tithe` load put down short of the barn (its hauler hurt, gone, sent back): the goods are the
 * colony's again and the share is due once more. Any other item is left as it is. */
export function dropTithe(world: WorldState, load: EntityRow): void {
  dropAsk(world, load);
  if (load['state'] !== 'tithe') return;
  const row = titheRow(world, load['kind'] as string);
  const n = load['count'] as number;
  if (row) {
    row['set'] = Math.max(0, (row['set'] as number) - n);
    row['due'] = (row['due'] as number) + n;
  }
  load['state'] = '';
}

/** Takes up to `count` of `kind` out of the barn, the lord's share first, then what is set apart
 * for asks; how many were there to take. */
export function fromBarn(world: WorldState, kind: string, count: number): number {
  const row = titheRow(world, kind);
  const n = Math.min(count, (row?.['barn'] as number | undefined) ?? 0);
  if (row && n > 0) row['barn'] = (row['barn'] as number) - n;
  return n + (n < count ? fromAsks(world, kind, count - n) : 0);
}

/** Whether surface tile (x, y) lies in the lord's forest (6C Slice 2): within `forest.reach` of
 * its middle, while the forest is the lord's (not granted to the colony). */
export function inForest(world: WorldState, content: EngineContent, x: number, y: number): boolean {
  const lord = world.entities['lord']?.[0];
  if (!lord?.['named'] || lord['granted'] || (lord['fx'] as number) < 0) return false;
  const d = Math.max(Math.abs(x - (lord['fx'] as number)), Math.abs(y - (lord['fy'] as number)));
  return d <= content.lord.forest.reach;
}
