// Free time (P6.3, P6.4). Winter evenings by the hearth (V-162): after dark in winter, someone at leisure on the
// surface goes to the nearest tile a lit fire warms (warm.ts `nearestWarm`) and stays there,
// relaxing, until morning or bed. Each hour by the fire they mend what they wear, tales.json
// `evening.mend` hours of wear a garment, up to its life when new. Tales pass most there (engine
// tales `byTheFire`). No line of its own: the tales told there are the lines.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { heatMap } from '../fire/index.ts';
import { lifeOf, wornOf } from '../goods/index.ts';
import { isDark } from '../lamp/index.ts';
import { isWinter } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practiceOf } from '../self/index.ts';
import { practise } from './learn.ts';
import { nearestWarm } from './warm.ts';
import { walkTo } from './walk.ts';

/** Minutes between looks for a fire to sit by, spread across people by id. */
const LOOK = 15;

/** Whether it is a winter evening: winter and dark. */
export const winterEvening = (world: WorldState, content: EngineContent): boolean =>
  isWinter(world, content) && isDark(content, world.tick);

/** Whether `p` stands on a surface tile a lit fire warms. */
export function byAFire(world: WorldState, content: EngineContent, p: EntityRow): boolean {
  if (p['z'] !== 0) return false;
  const i = (p['y'] as number) * world.map.width + (p['x'] as number);
  return (heatMap(world, content).get(i) ?? 0) > 0;
}

/** Each hour by the fire, every garment `p` wears is mended a little. */
function mend(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  if (world.tick % 60 !== 0) return;
  for (const item of wornOf(world, p.id)) {
    const full = lifeOf(content, item['kind'] as string, item['quality'] as string);
    const wear = item['wear'] as number;
    if (wear < full) item['wear'] = Math.min(full, wear + content.tales.evening.mend);
  }
}

/** One minute of someone's free time on a winter evening; true when they are by a fire (they stay
 * and mend) or have set off for one. */
export function gathering(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!winterEvening(world, content) || p['z'] !== 0) return false;
  if ((p['path'] as number[]).length) return false;
  if (byAFire(world, content, p)) {
    mend(ctx, p);
    return true;
  }
  if ((world.tick + p.id) % LOOK !== 0) return false;
  const spot = nearestWarm(ctx, p);
  return !!spot && walkTo(ctx, p, spot);
}

/** A minute of free time: one in every self.json `ambition.every` goes to the skill of `p`'s
 * ambition (P6.4, V-146), citing the line that set it. */
export function practising(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  if ((world.tick + p.id) % content.self.ambition.every !== 0) return;
  const goal = practiceOf(world, content, p.id);
  if (goal) practise(ctx, p, goal.skill, goal.line);
}
