// Leaving the valley (P6.7, V-160): at the top of the ladder, or sent away under the Punishment
// law, someone walks out by their home's road for good, taking what is theirs (people
// `defy.ts` walks them out; they take their clothes, bedroll and stash, and leave tools behind).
// Housemates go with them only if they share the grievance (6A review P4): the same law is the
// one they are furthest from keeping, they hold a memory and a belief against it, and they are
// as far up the ladder as taking (defy.json `leave.household`). Those left behind remember it,
// and the colony's standing falls for a season.
import { list, type EntityRow } from '../core/index.ts';
import { addCause } from '../colony/index.ts';
import { addEntity } from '../entity/index.ts';
import { itemsOf } from '../goods/index.ts';
import { homeHouse } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { atLeast, leavingOf, takesWith } from './tables.ts';
import { citesOf, grievanceOf, reasonsOf, whyWords, type Grievance, type Why } from './why.ts';

const alive = (ctx: SystemContext): EntityRow[] =>
  (ctx.world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** What `p` takes (their clothes, bedroll and stash), in words. */
function goodsWords(ctx: SystemContext, p: EntityRow): string {
  const mine = itemsOf(ctx.world).filter((i) => takesWith(ctx.content, i, p.id));
  const named = mine.map((i) => {
    const def = ctx.content.items.find((d) => d.id === i['kind']);
    const name = (def?.name ?? (i['kind'] as string)).toLowerCase();
    const n = i['count'] as number;
    return n > 1 ? `${n} ${name}` : name;
  });
  return named.length ? list([...new Set(named)]) : 'nothing';
}

/** Housemates who go with `p`: those who share the grievance with `law`, as far up the ladder
 * as taking. */
function household(ctx: SystemContext, p: EntityRow, law: string): EntityRow[] {
  const { world, content } = ctx;
  const home = homeHouse(world, content, p);
  if (!home || !content.defy.leave.household) return [];
  return alive(ctx).filter((q) => {
    if (q.id === p.id || leavingOf(world, q.id) || homeHouse(world, content, q) !== home)
      return false;
    if (!atLeast(world, content, q.id, 'take')) return false;
    const g = grievanceOf(world, content, q.id);
    if (g?.law !== law) return false;
    const why = reasonsOf(world, content, q.id, g.setting);
    return !!why.mem && !!why.belief;
  });
}

/** `p` leaves the valley over grievance `g` (or is sent away, `sent` the sentence's line);
 * returns the line. */
export function leave(
  ctx: SystemContext,
  p: EntityRow,
  g: Grievance | undefined,
  why: Why,
  sent = 0,
): number {
  const { world, content } = ctx;
  const already = leavingOf(world, p.id);
  if (already) return already;
  const going = g ? household(ctx, p, g.law) : [];
  const causes = g ? citesOf(g, why) : [];
  if (sent) causes.unshift(sent);
  const line = ctx.emit('defy.left', {
    causes,
    actors: [p.id, ...going.map((q) => q.id)],
    data: {
      name: p['name'] as string,
      dir: (p['homeDir'] as string) || 'south',
      with: going.length ? `, and ${list(going.map((q) => q['name'] as string))} with them` : '',
      goods: goodsWords(ctx, p),
      why: sent ? 'sent away' : whyWords(world, content, why),
    },
  });
  for (const q of [p, ...going]) addEntity(world, 'leaving', { person: q.id, line });
  const gone = new Set([p.id, ...going.map((q) => q.id)]);
  for (const q of alive(ctx))
    if (!gone.has(q.id)) addMemory(ctx, q.id, content.defy.memories['left']!, line, p.id);
  const st = content.defy.standing;
  addCause(ctx, 'left', st, st.text.replace('{name}', p['name'] as string), [line]);
  return line;
}
