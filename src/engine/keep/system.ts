// The keeping system (P5.12, V-132): food spoils each midnight (spoil.ts), and once every
// `keep.week` days each store that lost food says so in one line, naming what spoiled; food left
// lying in the open gets its own line. The week's counts are the `spoilage` table, cleared after
// (kept a few weeks as `spoilWeek`, lost.ts, which the smokehouse's siting reads, house.ts).
import { TICKS_PER_DAY, type EngineContent, type EntityRow } from '../core/index.ts';
import { depotsOf, storeOf } from '../goods/index.ts';
import type { Schemas } from '../entity/index.ts';
import { removeEntity } from '../entity/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { planCellar } from './cellar.ts';
import { planHouse } from './house.ts';
import { planKiln } from './kiln.ts';
import { noteWeek } from './lost.ts';
import { spoilDay } from './spoil.ts';

export const KEEP_TABLES: Schemas = {
  /** This week's loss of a kind at a store: a store of a kind's id, 0 the home store, -1 the open;
   * `made` the line of the first stack it came from, for "why?" in the open. */
  spoilage: { store: 'int', kind: 'text', count: 'count', made: 'event' },
  /** A past week's loss of a kind at a store, kept `keep.history` weeks (lost.ts); `line` is the
   * weekly line that said it, for what reads it to cite. */
  spoilWeek: { week: 'int', store: 'int', kind: 'text', count: 'count', line: 'event' },
  /** Barrels and pots on a store tile (cooper.ts, potter.ts); `line` the latest line that set one there. */
  cask: { x: 'int', y: 'int', z: 'int', barrels: 'count', pots: 'count', line: 'event' },
};

const nameOf = (content: EngineContent, kind: string): string =>
  content.items.find((i) => i.id === kind)?.name ?? kind;

/** "5 turnips and 2 fish": most first, ties in content order. */
function whatOf(content: EngineContent, rows: readonly EntityRow[]): string {
  const order = (k: string) => content.items.findIndex((i) => i.id === k);
  const parts = [...rows]
    .sort(
      (a, b) =>
        (b['count'] as number) - (a['count'] as number) ||
        order(a['kind'] as string) - order(b['kind'] as string),
    )
    .map((r) => `${r['count']} ${nameOf(content, r['kind'] as string)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]!;
}

/** Each store's line for the week, then the week starts again. */
function sayWeek(ctx: SystemContext): void {
  const { world, content } = ctx;
  const rows = world.entities['spoilage'] ?? [];
  const stores = [...new Set(rows.map((r) => r['store'] as number))].sort((a, b) => a - b);
  for (const store of stores) {
    const mine = rows.filter((r) => r['store'] === store && (r['count'] as number) > 0);
    if (!mine.length) continue;
    const count = mine.reduce((n, r) => n + (r['count'] as number), 0);
    const what = whatOf(content, mine);
    if (store < 0) {
      const line = ctx.emit('keep.spoiledOpen', {
        causes: [mine[0]!['made'] as number].filter((l) => l > 0),
        data: { count, what, where: content.work.keep.words.open },
      });
      noteWeek(ctx, store, mine, line);
      continue;
    }
    const depot = depotsOf(world).find((d) => d.id === store);
    const kind = content.buildings.stores.kinds.find((k) => k.id === depot?.['store']);
    const cause = depot
      ? (depot['built'] as number) || (depot['line'] as number)
      : ((storeOf(world)[0]?.['made'] as number | undefined) ?? 0);
    const line = ctx.emit('keep.spoiled', {
      causes: [cause].filter((l) => l > 0),
      data: { store, place: kind ? kind.name : content.work.keep.words.home, count, what },
    });
    noteWeek(ctx, store, mine, line);
  }
  for (const r of [...rows]) removeEntity(world, 'spoilage', r.id);
}

export const keepSystem: System = {
  id: 'keep',
  every: 'day',
  emits: [
    'keep.spoiled',
    'keep.spoiledOpen',
    'cure.housePlanned',
    'potter.kilnPlanned',
    'keep.cellarPlanned',
  ],
  tables: KEEP_TABLES,
  run(ctx) {
    spoilDay(ctx);
    const day = Math.floor(ctx.world.tick / TICKS_PER_DAY);
    if (day > 0 && day % ctx.content.work.keep.week === 0) sayWeek(ctx);
    planHouse(ctx);
    planKiln(ctx);
    planCellar(ctx);
  },
};
