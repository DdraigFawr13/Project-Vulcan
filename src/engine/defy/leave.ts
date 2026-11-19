// Leaving the valley (P6.7, V-160): at the top of the ladder, or sent away under the Punishment
// law, someone walks out by their home's road for good, taking what is theirs (people
// `defy.ts` walks them out; they take their clothes, bedroll and stash, and leave tools behind). Housemates who refuse the same
// law or stand in the same faction, and are as far up the ladder as taking, go with them (defy.json `leave.household`). Those left behind
// remember it, and the colony's standing falls for a season.
import { list, type EntityRow } from '../core/index.ts';
import { addCause, factionOf } from '../colony/index.ts';
import { addEntity } from '../entity/index.ts';
import { itemsOf } from '../goods/index.ts';
import { homeHouse } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { atLeast, leavingOf, takesWith } from './tables.ts';
import { citesOf, whyWords, type Grievance, type Why } from './why.ts';

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

/** Housemates who go with `p`: as far up the ladder as taking, refusing the same law or standing
 * in its faction. */
function household(ctx: SystemContext, p: EntityRow, law: string): EntityRow[] {
  const { world, content } = ctx;
  const home = homeHouse(world, content, p);
  if (!home || !content.defy.leave.household) return [];
  return alive(ctx).filter((q) => {
    if (q.id === p.id || leavingOf(world, q.id) || homeHouse(world, content, q) !== home)
      return false;
    const a = (world.entities['answer'] ?? []).find(
      (r) => r['person'] === q.id && r['law'] === law,
    );
    return (
      atLeast(world, content, q.id, 'take') &&
      (a?.['answer'] === 'refuses' || !!factionOf(world, q.id, law))
    );
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
