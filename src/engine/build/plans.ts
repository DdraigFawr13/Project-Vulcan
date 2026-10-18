// Plans (P3.1, V-049): a tile of a part colonists are to build, with what has been brought for
// it and the work left. Builders take plans up themselves (people/build.ts); this file owns the
// rows and what happens to the map when a part is finished or taken down.
import type { EngineContent, EntityRow, PartDef, WorldState } from '../core/index.ts';
import { removeEntity, type Schemas } from '../entity/index.ts';
import { cutStairsAt, setBuilt } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const BUILD_TABLES: Schemas = {
  /** One tile of one part. `state`: `plan` (to build), `built`, or `down` (to come down: a built
   * part, or a plan with material brought). `have`: material brought so far; `work`: minutes
   * left once building has started, -1 before; `line`: the plan's line; `done`: the line it
   * was built under, 0 before; `waited`: the line saying it waits for material, 0 when not;
   * `shut`: the line saying the wall would shut someone in or the store off, 0 when not;
   * `held`: the tick before which nobody tries to finish it again. */
  plan: {
    part: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    have: 'count',
    work: 'int',
    state: 'text',
    line: 'event',
    done: 'event',
    waited: 'event',
    shut: 'event',
    held: 'int',
  },
};

export const plansOf = (world: WorldState): EntityRow[] => world.entities['plan'] ?? [];

export const planAt = (world: WorldState, x: number, y: number, z = 0): EntityRow | undefined =>
  plansOf(world).find((p) => p['x'] === x && p['y'] === y && p['z'] === z);

export const partOf = (content: EngineContent, id: string): PartDef | undefined =>
  content.buildings.parts.find((p) => p.id === id);

/** The part a plan row is for (content is checked when the plan is placed). */
export const planPart = (content: EngineContent, plan: EntityRow): PartDef =>
  partOf(content, plan['part'] as string)!;

/** How much material a plan still needs brought before work can start. */
export const stillNeeded = (content: EngineContent, plan: EntityRow): number =>
  plan['state'] === 'plan' ? planPart(content, plan).cost - (plan['have'] as number) : 0;

/** The material taking the plan down gives back: all of it for a built part, what was brought
 * for a plan. */
export const refundOf = (content: EngineContent, plan: EntityRow): number =>
  (plan['done'] as number) > 0 ? planPart(content, plan).cost : (plan['have'] as number);

/** The part is finished under `cause` (the builder's line): a wall, door or floor is set on the
 * map; a stair cuts stairs down, reaching the level below if nobody has. */
export function finishPlan(ctx: SystemContext, plan: EntityRow, cause: number): void {
  const part = planPart(ctx.content, plan);
  const [x, y, z] = [plan['x'] as number, plan['y'] as number, plan['z'] as number];
  if (part.kind === 'stair') cutStairsAt(ctx, x, y, z, cause);
  else setBuilt(ctx, x, y, ctx.content.buildings.parts.indexOf(part) + 1, cause);
  Object.assign(plan, { state: 'built', done: cause, work: 0, waited: 0 });
}

/** The part (or plan) comes down under `cause`: the map loses it and the row goes. Returns the
 * material to lay back on the ground (`refundOf`). */
export function takeDownPlan(
  ctx: SystemContext,
  plan: EntityRow,
  cause: number,
): { kind: string; count: number } {
  const back = { kind: planPart(ctx.content, plan).material, count: refundOf(ctx.content, plan) };
  if ((plan['done'] as number) > 0)
    setBuilt(ctx, plan['x'] as number, plan['y'] as number, 0, cause);
  removeEntity(ctx.world, 'plan', plan.id);
  return back;
}
