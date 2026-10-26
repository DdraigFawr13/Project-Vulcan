// The lamp system (P5.13): owns the rooms' candles. Lighting and burning are the people's, minute by
// minute (light.ts `lit`, from people/jobs.ts); daily it drops spent candles nobody has lit since.
import type { System, SystemContext } from '../sim/index.ts';
import { removeEntity } from '../entity/index.ts';
import { LAMP_TABLES, lightsOf } from './light.ts';

function sweep(ctx: SystemContext): void {
  const { world } = ctx;
  const today = Math.floor(world.tick / 1440);
  for (const r of [...lightsOf(world)])
    if (!r['kind'] && (r['dark'] as number) < today - 1 && (r['left'] as number) <= 0)
      removeEntity(world, 'light', r.id);
}

export const lampSystem: System = {
  id: 'lamp',
  every: 'day',
  emits: ['lamp.lit', 'lamp.dark'],
  tables: LAMP_TABLES,
  run: sweep,
};
