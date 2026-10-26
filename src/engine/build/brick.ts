// Bricks and the wall rule (5B Bundle 3, V-096, V-132): once a kiln stands, brick is one of the
// wall materials a house may be built of, counted by the bricks in hand plus what the clay in the
// stores would fire into (`potter.brick.per` bricks for `potter.clay` clay). The potter fires
// bricks while the planned walls want more than the colony has (people/potter.ts).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { haveOf } from '../goods/index.ts';
import { planPart, plansOf } from './plans.ts';
import { stationOf } from './station.ts';

/** The built kiln, if there is one. */
export const kilnOf = (world: WorldState): EntityRow | undefined => {
  const kiln = stationOf(world, 'kiln');
  return kiln?.['state'] === 'built' ? kiln : undefined;
};

/** The bricks the clay in the stores would make, once a kiln is built, for `good` brick; else 0. */
export function clayBricks(world: WorldState, content: EngineContent, good: string): number {
  const def = content.work.potter;
  if (good !== def.brick.item || !kilnOf(world)) return 0;
  return Math.floor((haveOf(world, content, def.clayItem) * def.brick.per) / def.clay);
}

/** The bricks the planned parts still lack: what they need brought, less the bricks in hand; and
 * the first plan that wants them. */
export function bricksWanted(
  world: WorldState,
  content: EngineContent,
): { count: number; plan: EntityRow | undefined } {
  const brick = content.work.potter.brick.item;
  let need = 0;
  let plan: EntityRow | undefined;
  for (const p of plansOf(world)) {
    const part = planPart(content, p);
    if (p['state'] !== 'plan' || part.material !== brick) continue;
    need += Math.max(0, part.cost - (p['have'] as number));
    plan ??= p;
  }
  return { count: Math.max(0, need - haveOf(world, content, brick)), plan };
}
