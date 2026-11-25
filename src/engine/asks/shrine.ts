// The shrine's asks (6C Slice 3, V-225). At each harvest home the priest of every creed with a
// shrine asks the colony for what its faith's first `sacred` tag wants (`asks.shrine.asks`), by
// the next harvest home, when it is settled: done, laid at the shrine, the faithful gain
// `shrine.done`; let pass or late, `shrine.passed`. Only the creed's own faithful work it (crafts
// askmade.ts). Saying no costs goodwill, never a person.
import type { EntityRow } from '../core/index.ts';
import { people } from '../entity/index.ts';
import { creedsOf, faithWords, holdersOf } from '../faith/index.ts';
import { liveAsks } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addAsk, settleAsk, wantsOf } from './asks.ts';

/** The first harvest-home supper after feast row `seen` (a supper with no couple and no feast
 * day, as the lord's reeve reads it), if any. */
export const harvestAfter = (ctx: SystemContext, seen: number): EntityRow | undefined =>
  (ctx.world.entities['feast'] ?? []).find(
    (f) => f.id > seen && !(f['couple'] as number[]).length && !f['holy'],
  );

/** Settles the shrine asks due at this harvest home (`cause`), with the faithful's memories. */
function settleShrine(ctx: SystemContext, cause: number): void {
  const { world, content } = ctx;
  for (const a of liveAsks(world)) {
    if (a['source'] !== 'faith') continue;
    const creed = creedsOf(world).find((c) => String(c.id) === a['of']);
    const priest = people(world).find((p) => p.id === creed?.['priest']);
    const who = priest ? (priest['name'] as string) : 'the faithful';
    const { how, line } = settleAsk(ctx, a, [cause], { who });
    const memory = how === 'done' ? content.asks.shrine.done : content.asks.shrine.passed;
    for (const h of creed ? holdersOf(world, creed.id) : []) addMemory(ctx, h.id, memory, line);
  }
}

/** At a harvest home (its line `cause`): the shrine asks due are settled, then each creed with a
 * shrine and a living priest asks anew. */
export function shrineAsks(ctx: SystemContext, cause: number): void {
  const { world, content } = ctx;
  settleShrine(ctx, cause);
  for (const creed of creedsOf(world)) {
    const priest = people(world).find((p) => p.id === creed['priest'] && p['status'] === 'alive');
    const def = content.faiths.defs.find((d) => d.id === creed['faith']);
    const want = def?.sacred[0] && content.asks.shrine.asks[def.sacred[0]];
    if (!creed['shrine'] || !priest || !want) continue;
    const wants = wantsOf(ctx, want);
    const faith = faithWords(creed);
    const line = ctx.emit('faith.asked', {
      causes: [cause, creed['named'] as number].filter((l) => l > 0),
      actors: [priest.id],
      data: {
        ...{ priest: priest['name'] as string, title: creed['title'] as string },
        ...{ faith, what: wants.what },
      },
    });
    const asker = `the shrine of ${faith}`;
    addAsk(ctx, {
      ...wants,
      source: 'faith',
      asker,
      cite: cause,
      line,
      due: 0,
      of: String(creed.id),
    });
  }
}
