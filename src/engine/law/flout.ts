// A refuser seen keeping the custom (P4.8, V-091; P6.5 for every law): one line saying what they
// did, and whoever sees it remembers it about them (and may lean the same way).
import { list, type EntityRow, type LawSettingDef } from '../core/index.ts';
import { houseAt } from '../build/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Whether `q` can see `p`: the same level within sight, or the same house. */
function sees(ctx: SystemContext, p: EntityRow, q: EntityRow): boolean {
  const at = (r: EntityRow, k: string) => r[k] as number;
  if (at(p, 'z') !== at(q, 'z')) return false;
  const far = Math.max(Math.abs(at(p, 'x') - at(q, 'x')), Math.abs(at(p, 'y') - at(q, 'y')));
  if (far <= ctx.content.laws.answer.sight) return true;
  if (at(p, 'z') !== 0) return false;
  const house = houseAt(ctx.world, at(p, 'x'), at(p, 'y'));
  return !!house && house === houseAt(ctx.world, at(q, 'x'), at(q, 'y'));
}

/** `p`, who refused `s` (answer row `a`), `did` the custom's thing: `law.keptCustom`, then
 * `law.saw` for the awake who see it, who gain the setting's `saw` memory about them. */
export function flout(
  ctx: SystemContext,
  s: LawSettingDef,
  a: EntityRow,
  p: EntityRow,
  did: string,
): void {
  const kept = ctx.emit('law.keptCustom', {
    causes: [a['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, did, days: s.days },
  });
  const saw = (ctx.world.entities['person'] ?? []).filter(
    (q) => q.id !== p.id && q['status'] === 'alive' && q['doing'] !== 'sleep' && sees(ctx, p, q),
  );
  if (!saw.length || !s.saw) return;
  const line = ctx.emit('law.saw', {
    causes: [kept],
    actors: saw.map((q) => q.id),
    data: {
      names: list(saw.map((q) => q['name'] as string)),
      name: p['name'] as string,
      days: s.days,
    },
  });
  for (const q of saw) addMemory(ctx, q.id, s.saw, line, p.id);
}
