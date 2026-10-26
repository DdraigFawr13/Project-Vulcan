// The cellar (5B Bundle 3, V-041, V-132): nobody places it. When the roots and berries a built
// larder lost over the kept weeks reach `keep.cellar.need` and it has no cellar, the colony plans
// one: a stair at the larder's inside tile nearest the green (by its door) and the larder's inside
// tiles dug out one level down. The plan is a `shaft` row of the cellar's kind (so the miners'
// sinking and digging are reused, people/cellar.ts); when the last tile is dug the cellar is a
// store of its own kind, a `depot` row at z = 1 under the larder, taking its goods before the
// larder does (goods/store.ts) and keeping at the steady underground temperature (spoil.ts).
import { greenOf } from '../build/index.ts';
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { depotsOf, depotTiles, insideDepot, storeKindOf } from '../goods/index.ts';
import { diggable, layerOf, makeLevel } from '../map/index.ts';
import { shaftsOf } from '../mine/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lostLine, lostOf } from './lost.ts';

/** The store kind dug below a larder (content `buildings.stores.kinds`, `below`). */
export const cellarKind = (content: EngineContent): string =>
  content.buildings.stores.kinds.find((k) => k.below)!.id;

/** The built larder a cellar plan's stair stands in, if any. */
export const larderOf = (world: WorldState, shaft: EntityRow): EntityRow | undefined =>
  depotsOf(world).find(
    (d) =>
      d['z'] === 0 &&
      d['state'] === 'built' &&
      insideDepot(d, shaft['x'] as number, shaft['y'] as number),
  );

/** Whether a larder has a cellar, built or planned. */
function hasCellar(world: WorldState, content: EngineContent, d: EntityRow): boolean {
  const kind = cellarKind(content);
  return (
    depotsOf(world).some((c) => c['store'] === kind && c['x'] === d['x'] && c['y'] === d['y']) ||
    shaftsOf(world).some(
      (s) => s['metal'] === kind && insideDepot(d, s['x'] as number, s['y'] as number),
    )
  );
}

/** Whether every inside tile of the larder is, one level down, rock or earth to dig or open ground
 * to walk (a cave floor), never water: the level is read from the seed if nobody has reached it. */
function roomBelow(ctx: SystemContext, tiles: readonly EntityRow[]): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const layer = layerOf(map, 1) ?? makeLevel(world.seed, content, map, 1);
  return tiles.every((t) => {
    const kind =
      content.terrain.kinds[layer.tiles[(t['y'] as number) * map.width + (t['x'] as number)]!]!;
    return diggable(kind) || !kind.water;
  });
}

/** Daily: plans a cellar under a larder that lost enough roots and berries (`keep.cellarPlanned`,
 * citing the latest weekly line that lost some). */
export function planCellar(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const def = content.work.keep.cellar;
  const kind = storeKindOf(content, content.work.cure.from[0]!)?.id;
  // One cellar dug at a time, under the larder that lost enough itself.
  const dug = (l: EntityRow | undefined) =>
    !!l && depotsOf(world).some((c) => c['z'] === 1 && c['x'] === l['x'] && c['y'] === l['y']);
  const digging = shaftsOf(world).some(
    (s) => s['metal'] === cellarKind(content) && s['state'] !== 'sent' && !dug(larderOf(world, s)),
  );
  if (digging) return;
  const larder = depotsOf(world).find(
    (d) =>
      d['store'] === kind &&
      d['z'] === 0 &&
      d['state'] === 'built' &&
      !state[`no-${d.id}`] &&
      lostOf(world, def.kinds, d.id) >= def.need &&
      !hasCellar(world, content, d),
  );
  if (!larder) return;
  const lost = lostOf(world, def.kinds, larder.id);
  const green = greenOf(world);
  const inside = depotTiles(larder);
  // The stair: the inside tile nearest the green, where the door faces.
  const far = (t: EntityRow) =>
    Math.max(Math.abs((t['x'] as number) - green.x), Math.abs((t['y'] as number) - green.y));
  const stair = [...inside].sort(
    (a, b) =>
      far(a) - far(b) ||
      (a['y'] as number) - (b['y'] as number) ||
      (a['x'] as number) - (b['x'] as number),
  )[0]!;
  // Groundwater below: no cellar under this larder, and it is not looked at again.
  if (!roomBelow(ctx, inside)) {
    state[`no-${larder.id}`] = 1;
    return;
  }
  const cause = lostLine(world, def.kinds, larder.id);
  const why = def.why.replace('{count}', String(lost));
  const line = ctx.emit('keep.cellarPlanned', {
    causes: cause ? [cause] : [],
    data: { where: 'under the larder', why },
  });
  addEntity(world, 'shaft', {
    ...{ x: stair['x'] as number, y: stair['y'] as number, metal: cellarKind(content) },
    ...{ to: 1, state: 'planned', depth: 0, sentBack: 1, line, why },
  });
}

/** The tiles of a cellar plan that are still to be dug: its larder's inside tiles on level 1 that
 * are rock or earth. */
export function toDig(world: WorldState, content: EngineContent, shaft: EntityRow): EntityRow[] {
  const larder = larderOf(world, shaft);
  const layer = layerOf(world.map, 1);
  if (!larder || !layer) return [];
  return depotTiles(larder).filter((t) =>
    diggable(
      content.terrain.kinds[
        layer.tiles[(t['y'] as number) * world.map.width + (t['x'] as number)]!
      ]!,
    ),
  );
}

/** The last tile of a cellar is dug: the cellar is a store (`keep.cellarDug`, citing the line that
 * dug the tile and the plan). Returns whether it was. */
export function finishCellar(
  ctx: SystemContext,
  shaft: EntityRow,
  who: string,
  dug: number,
): boolean {
  const { world, content } = ctx;
  const larder = larderOf(world, shaft);
  if (!larder || shaft['depth'] !== 1 || toDig(world, content, shaft).length) return false;
  const built = ctx.emit('keep.cellarDug', {
    causes: [dug, shaft['line'] as number],
    data: { name: who },
  });
  addEntity(world, 'depot', {
    ...{ store: cellarKind(content), x: larder['x'] as number, y: larder['y'] as number, z: 1 },
    ...{
      w: larder['w'] as number,
      h: larder['h'] as number,
      state: 'built',
      line: shaft['line'] as number,
    },
    ...{ built, builtTick: world.tick },
  });
  return true;
}
