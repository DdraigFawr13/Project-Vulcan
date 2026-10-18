// The build system (P3.1, P3.2): owns the plans. Until the Build sheet (P3.7) lets colonists
// site buildings themselves, a plan is placed only with the test-mode `placeBuilding` tool, and
// `deconstruct` (also test mode) asks for a part to come down (V-041, V-049). Builders take the
// work up themselves (people/build.ts). Each hour it checks that someone is able to build while
// plans wait, and says so once when nobody is.
import type { EngineContent, EntityRow } from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { inStore, itemsAt, raiseStock } from '../goods/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { BUILD_TABLES, partOf, planAt, planPart, plansOf } from './plans.ts';

function refuse(ctx: SystemContext, kind: string, reason: string, cause: number): void {
  ctx.emit('command.refused', { causes: [cause], data: { kind, reason } });
}

/** Why a part cannot be planned on surface tile (x, y), or undefined when it can. */
function unfit(ctx: SystemContext, kind: string, x: number, y: number): string | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const i = y * map.width + x;
  if (!content.terrain.kinds[map.tiles[i]!]!.buildable)
    return 'the ground there cannot be built on';
  const f = map.features[i]!;
  if (f) return `a ${content.features[f - 1]!.name} is there`;
  if (planAt(world, x, y) || map.built[i]) return 'something is built or planned there';
  if (inStore(world, x, y, 0)) return 'the store is there';
  if (kind !== 'floor' && itemsAt(world, x, y, 0).length) return 'something lies there';
  return undefined;
}

/** `placeBuilding {part, x, y}` (test mode): a plan on a surface tile. */
function placeBuilding(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number) {
  const { world, content } = ctx;
  const map = world.map;
  const part = partOf(content, data['part'] as string);
  const [x, y] = [data['x'] as number, data['y'] as number];
  if (!part) return refuse(ctx, 'placeBuilding', 'no such part', cause);
  if (![x, y].every(Number.isInteger) || x < 0 || y < 0 || x >= map.width || y >= map.height)
    return refuse(ctx, 'placeBuilding', 'that is not a tile of the map', cause);
  const why = unfit(ctx, part.kind, x, y);
  if (why) return refuse(ctx, 'placeBuilding', why, cause);
  const line = ctx.emit('build.planned', { causes: [cause], data: { part: part.name, x, y } });
  addEntity(world, 'plan', {
    ...{ part: part.id, x, y, z: 0, have: 0, work: -1, state: 'plan' },
    ...{ line, done: 0, waited: 0 },
  });
  raiseStock(ctx, part.material, part.name, line);
}

/** `deconstruct {x, y}` (test mode): a part or plan there is to come down. A plan nothing was
 * brought for is dropped at once; anything else waits for a builder to take it down. */
function deconstruct(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number) {
  const { world, content } = ctx;
  const plan = planAt(world, data['x'] as number, data['y'] as number);
  if (!plan || plan['state'] === 'down')
    return refuse(ctx, 'deconstruct', 'nothing to take down there', cause);
  const part = planPart(content, plan);
  const at = { part: part.name, x: plan['x'] as number, y: plan['y'] as number };
  if (part.kind === 'stair' && plan['state'] === 'built')
    return refuse(ctx, 'deconstruct', 'a stair stays once cut', cause);
  if (plan['state'] === 'plan' && !(plan['have'] as number)) {
    ctx.emit('build.dropped', { causes: [cause], data: at });
    return removeEntity(world, 'plan', plan.id);
  }
  plan['line'] = ctx.emit('build.downOrdered', { causes: [cause], data: at });
  Object.assign(plan, { state: 'down', work: -1, waited: 0 });
}

/** Whether a person meets the build job's attribute requirements (jobs.json). */
function ableToBuild(content: EngineContent, p: EntityRow): boolean {
  const def = content.jobs.find((j) => j.id === content.buildings.job);
  return (
    p['status'] === 'alive' &&
    !!def &&
    Object.entries(def.requirements).every(([a, need]) => ((p[a] as number) ?? 0) >= need)
  );
}

export const buildSystem: System = {
  id: 'build',
  every: 'hour',
  emits: ['build.planned', 'build.dropped', 'build.downOrdered', 'build.nobody'],
  // The line saying nobody is able to build, while that holds; 0 otherwise.
  initialState: { nobody: 0 },
  refs: ['nobody'],
  tables: BUILD_TABLES,
  commands: {
    placeBuilding: (ctx, command, cause) => placeBuilding(ctx, command.data, cause),
    deconstruct: (ctx, command, cause) => deconstruct(ctx, command.data, cause),
  },
  run(ctx) {
    const { world, content, state } = ctx;
    const waiting = plansOf(world).find((p) => p['state'] !== 'built');
    const someone = (world.entities['person'] ?? []).some((p) => ableToBuild(content, p));
    if (!waiting || someone) {
      state['nobody'] = 0;
      return;
    }
    if (state['nobody']) return;
    state['nobody'] = ctx.emit('build.nobody', {
      causes: [waiting['line'] as number],
      data: {
        part: planPart(content, waiting).name,
        x: waiting['x'] as number,
        y: waiting['y'] as number,
      },
    });
  },
};
