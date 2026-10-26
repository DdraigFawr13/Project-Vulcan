// Soap in the homes (P5.7, V-135): each week the colony takes one piece of soap from the store for
// each home (lamp `chandler.soap.item`). With a piece for every home, the illnesses in
// `sick.soap.ills` (the flux, a griping belly) catch `soap.cut` per cent less often that week, and
// so does a catching illness between roommates; with pieces for some, by their share. Said when
// the homes start washing and when the soap runs out.
import { TICKS_PER_DAY, type WorldState } from '../core/index.ts';
import { housesOf } from '../build/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { inStore, itemsOf, takeFrom } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const SOAP_TABLES: Schemas = {
  /** The week's washing: per cent off catching until tick `until`. */
  soap: { until: 'int', cut: 'count' },
};

/** The per cent the homes' soap takes off catching now (0 without). */
export function soapCut(world: WorldState): number {
  const row = (world.entities['soap'] ?? [])[0];
  return row && world.tick < (row['until'] as number) ? (row['cut'] as number) : 0;
}

/** The houses built to live in (not a workshop's room), by id. */
export const homesOf = (world: WorldState): Set<number> =>
  new Set(
    housesOf(world)
      .filter((h) => !h['of'] && h['state'] === 'built')
      .map((h) => h.id),
  );

/** At the week's first midnight: a piece of soap from the store for each home, while it lasts. */
export function soapWeek(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % (7 * TICKS_PER_DAY) !== 0) return;
  const homes = homesOf(world);
  if (!homes.size) return;
  const item = content.lamp.chandler.soap.item;
  let took = 0;
  for (const i of [...itemsOf(world)]) {
    if (took >= homes.size) break;
    if (i['kind'] !== item || i['holder']) continue;
    if (!inStore(world, i['x'] as number, i['y'] as number, i['z'] as number)) continue;
    const n = Math.min(i['count'] as number, homes.size - took);
    took += n;
    takeFrom(world, i, n);
  }
  const cut = Math.floor((content.health.sick.soap.cut * took) / homes.size);
  let row = (world.entities['soap'] ?? [])[0];
  if (!row) {
    addEntity(world, 'soap', { until: 0, cut: 0 });
    row = world.entities['soap']![0]!;
  }
  // Last week's washing, which ends as this one is taken.
  const was = (row['cut'] as number) > 0;
  Object.assign(row, { until: cut ? world.tick + 7 * TICKS_PER_DAY : 0, cut });
  if (!!cut !== was)
    ctx.emit(cut ? 'health.soap' : 'health.noSoap', {
      data: { homes: homes.size, took },
    });
}
