// After dusk (P5.13): which work can still be taken up, and how the rest of the working day goes
// for someone with none. jobs.ts asks it once dark falls on the surface.
import type { EntityRow } from '../core/index.ts';
import { canLight, lightClass, nextDawn } from '../lamp/index.ts';
import { needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Whether a kind of work can be taken up after dusk: dark and fire work can, a candle trade
 * when its room has a candle or the store one to light. */
export function workableInDark(ctx: SystemContext, job: string): boolean {
  const cls = lightClass(ctx.content, job);
  return (
    cls === 'dark' || cls === 'dim' || (cls === 'candle' && canLight(ctx.world, ctx.content, job))
  );
}

/** Recreation and the look-again wait as by day, then only work the dark allows (`takeUp` with
 * `dark` set). Someone with none keeps their daylight work (a tree, a bush) for the morning and
 * looks again at first light at the latest, not an hour into it. */
export function afterDusk(
  ctx: SystemContext,
  p: EntityRow,
  takeUp: (ctx: SystemContext, p: EntityRow, dark: boolean) => boolean,
): boolean {
  const { world, content } = ctx;
  const fun = needOf(world, p.id, 'recreation');
  const seek = content.life.needs.find((n) => n.id === 'recreation')?.seek ?? 0;
  if (fun && (fun['value'] as number) < seek) return false;
  if (world.tick < (p['next'] as number)) return false;
  const [job, target, work] = [p['job'], p['target'], p['work']];
  if (takeUp(ctx, p, true)) return true;
  if (lightClass(content, job as string) === 'out') Object.assign(p, { job, target, work });
  p['next'] = Math.min(p['next'] as number, nextDawn(content, world.tick));
  return false;
}
