// The town ring (P4.7, V-050, V-053): houses are sited within it, round the green, and fields lie
// outside it. It starts at content `buildings.town.ring` tiles (Chebyshev from the green) and
// widens by `step`, up to `most`, when no ground inside it fits a house. Kept in the build
// system's state (`ring`, 0 until it first widens; `ringLine`, the last line that widened it).
import type { EngineContent, WorldState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** The ring's radius now, in tiles from the green. */
export const ringOf = (world: WorldState, content: EngineContent): number =>
  world.systems['build']?.['ring'] || content.buildings.town.ring;

/** Widens the ring by one step (`town.ringWidened`, citing `cause`); the line, or 0 when it is
 * already at its widest. */
export function widenRing(ctx: SystemContext, cause: number): number {
  const { world, content, state } = ctx;
  const town = content.buildings.town;
  const now = ringOf(world, content);
  if (now >= town.most) return 0;
  const ring = Math.min(town.most, now + town.step);
  state['ring'] = ring;
  state['ringLine'] = ctx.emit('town.ringWidened', { causes: [cause], data: { ring } });
  return state['ringLine'];
}
