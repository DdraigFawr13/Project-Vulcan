// Plans (P3.1, V-049): a tile of a part colonists are to build, with what has been brought for
// it and the work left. Builders take plans up themselves (people/build.ts); this file owns the
// rows and what happens to the map when a part is finished or taken down.
import type { EngineContent, EntityRow, PartDef, WorldState } from '../core/index.ts';
import { removeEntity, type Schemas } from '../entity/index.ts';
import { cutStairsAt, setBuilt } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const BUILD_TABLES: Schemas = {
  /** One tile of one part. `state`: `plan` (to build), `built`, or `down` (to come down: a built
   * part, or a plan with material brought). `have`: material brought so far; `also`: the
   * part's second material brought so far (0 for a part with one material); `work`: minutes
   * left once building has started, -1 before; `line`: the plan's line; `done`: the line it
   * was built under, 0 before; `waited`: the line saying it waits for material, 0 when not;
   * `shut`: the line saying the wall would shut someone in or the store off, 0 when not;
   * `held`: the tick before which nobody tries to finish it again; `house`: the house (or
   * room) it is part of, 0 for a part placed in test mode. */
  plan: {
    part: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    have: 'count',
    also: 'count',
    work: 'int',
    state: 'text',
    line: 'event',
    done: 'event',
    waited: 'event',
    shut: 'event',
    held: 'int',
    house: 'entity',
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

/** The material a plan needs brought next and how much: the part's own first, then its second
 * (`also`), once the first is in; undefined once all is in or for a part to come down. */
export function nextNeed(
  content: EngineContent,
  plan: EntityRow,
): { material: string; count: number } | undefined {
  if (plan['state'] !== 'plan') return undefined;
  const part = planPart(content, plan);
  const main = part.cost - (plan['have'] as number);
  if (main > 0) return { material: part.material, count: main };
  const more = part.also ? part.also.cost - (plan['also'] as number) : 0;
  return part.also && more > 0 ? { material: part.also.material, count: more } : undefined;
}

/** How much material a plan still needs brought before work can start, of both its materials. */
export function stillNeeded(content: EngineContent, plan: EntityRow): number {
  if (plan['state'] !== 'plan') return 0;
  const part = planPart(content, plan);
  const main = part.cost - (plan['have'] as number);
  return main + (part.also ? part.also.cost - (plan['also'] as number) : 0);
}

/** The material taking the plan down gives back, by item: all of it for a built part, what was
 * brought for a plan. */
export function refundOf(
  content: EngineContent,
  plan: EntityRow,
): { kind: string; count: number }[] {
  const part = planPart(content, plan);
  const built = (plan['done'] as number) > 0;
  const out = [{ kind: part.material, count: built ? part.cost : (plan['have'] as number) }];
  if (part.also)
    out.push({
      kind: part.also.material,
      count: built ? part.also.cost : (plan['also'] as number),
    });
  return out;
}

/** The part is finished under `cause` (the builder's line): a wall, door or floor is set on the
 * map (anything growing there is cleared); a stair cuts stairs down, reaching the level below if nobody has. */
export function finishPlan(ctx: SystemContext, plan: EntityRow, cause: number): void {
  const part = planPart(ctx.content, plan);
  const [x, y, z] = [plan['x'] as number, plan['y'] as number, plan['z'] as number];
  // A bush or herbs on a house's site is cleared as the part goes up (site.ts).
  if (z === 0) ctx.world.map.features[y * ctx.world.map.width + x] = 0;
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
): { kind: string; count: number }[] {
  const back = refundOf(ctx.content, plan);
  if ((plan['done'] as number) > 0)
    setBuilt(ctx, plan['x'] as number, plan['y'] as number, 0, cause);
  removeEntity(ctx.world, 'plan', plan.id);
  return back;
}
