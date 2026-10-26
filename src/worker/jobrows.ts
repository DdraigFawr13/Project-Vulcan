// Which Work rows exist yet (V-071): a row appears once its station does. A pure read, like works.ts.
import { content } from '../content/index.ts';
import { livePastures, piecesOf, stationsOf, type WorldState } from '../engine/index.ts';

/** Whether a Work row's station exists (the pasture for herding): the clamp once marked, the smelter, the smokehouse, the forge and
 * a bench once built. Rows with no station are left off the sheet (V-071). */
export function jobShown(world: WorldState, job: string): boolean {
  if (job === content.metal.clamp.job) return stationsOf(world).some((s) => s['kind'] === 'clamp');
  if (job === content.metal.smelter.job)
    return stationsOf(world).some((s) => s['kind'] === 'smelter' && s['state'] === 'built');
  // The Larder rows wait for the smokehouse, a bench and the kiln.
  if (job === content.work.cure.job)
    return stationsOf(world).some((s) => s['kind'] === 'smokehouse' && s['state'] === 'built');
  if (job === content.work.cooper.job) return piecesOf(world, 'bench').length > 0;
  if (job === content.work.potter.job)
    return stationsOf(world).some((s) => s['kind'] === 'kiln' && s['state'] === 'built');
  // Herding waits for a pasture, planned or built.
  if (job === content.flock.job) return livePastures(world).length > 0;
  if (job === 'smith') return piecesOf(world, 'forge').some((f) => f['state'] === 'built');
  return true;
}
