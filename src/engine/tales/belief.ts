// Beliefs (P6.3, V-155): a version at its tale's `from` level or worse feeds the tale's belief,
// 2 steps for a thing seen and 1 for one heard, up to certain (4). A belief not fed for
// `beliefFadeDays` drops a step, and goes at 0. No lines: the tale line that fed it is its cause.
import { TICKS_PER_DAY, type EntityRow, type TaleDef } from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

const MOST = 4;

/** `person` now holds `def`'s story at `level`, seen (or heard) in `line`. */
export function feedBelief(
  ctx: SystemContext,
  person: number,
  def: TaleDef,
  level: number,
  seen: boolean,
  line: number,
): void {
  if (level < def.from) return;
  const { world } = ctx;
  const by = seen ? 2 : 1;
  const row = (world.entities['belief'] ?? []).find(
    (b) => b['person'] === person && b['belief'] === def.belief,
  );
  if (!row) {
    addEntity(world, 'belief', { person, belief: def.belief, strength: by, line, fed: world.tick });
    return;
  }
  Object.assign(row, {
    strength: Math.min(MOST, (row['strength'] as number) + by),
    line,
    fed: world.tick,
  });
}

/** Each belief left unfed for its fade days drops a step. */
export function fadeBeliefs(ctx: SystemContext): void {
  const { world, content } = ctx;
  const span = content.tales.beliefFadeDays * TICKS_PER_DAY;
  const gone: EntityRow[] = [];
  for (const b of world.entities['belief'] ?? []) {
    if (world.tick - (b['fed'] as number) < span) continue;
    b['strength'] = (b['strength'] as number) - 1;
    b['fed'] = world.tick;
    if ((b['strength'] as number) <= 0) gone.push(b);
  }
  for (const b of gone) removeEntity(world, 'belief', b.id);
}
