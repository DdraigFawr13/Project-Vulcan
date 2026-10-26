// Changing clothes (Phase 5B Bundle 5, P5.5, V-041): nobody is told to. In work hours, before
// taking up work, someone whose everyday clothes or outer layer has worn through, or is down to
// clothes.json `change` per cent, walks to the warmest spare of that slot lying in a store, puts it
// on and leaves the old one, with one line. A fine new garment leaves the `fine` memory.
import type { EntityRow } from '../core/index.ts';
import { removeEntity } from '../entity/index.ts';
import { garmentOf, itemsOf, leftOf, sparesOf, wornIn } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { people, same, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', target: -1 });
  return false;
};

const nameOf = (ctx: SystemContext, kind: string): string =>
  ctx.content.items.find((i) => i.id === kind)?.name ?? kind;

/** The slot `p` should change, if any: one with nothing in it, else one worn thin. */
function slotToChange(ctx: SystemContext, p: EntityRow): string | undefined {
  const { world, content } = ctx;
  return content.clothes.slots.find((s) => {
    const worn = wornIn(world, content, p.id, s.id);
    return !worn || leftOf(content, worn) < content.clothes.change;
  })?.id;
}

/** Sets off for a spare when one of their slots needs it and nobody else is going for it. */
export function takeUpChange(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const slot = slotToChange(ctx, p);
  if (!slot) return false;
  const taken = new Set(people(world).map((q) => (q['job'] === 'change' ? q['target'] : -1)));
  for (const spare of sparesOf(world, content, slot)) {
    if (taken.has(spare.id) || !walkTo(ctx, p, spotOf(spare))) continue;
    Object.assign(p, { job: 'change', target: spare.id, doing: 'work' });
    return true;
  }
  return false;
}

/** One minute of the errand; false when it is done or the spare has gone. */
export function changing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const spare = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  const g = spare && garmentOf(content, spare['kind'] as string);
  if (!spare || !g) return stop(p);
  if (!same(spotOf(spare), spotOf(p))) return walkTo(ctx, p, spotOf(spare)) || stop(p);
  const old = wornIn(world, content, p.id, g.slot);
  if (old) removeEntity(world, 'item', old.id);
  Object.assign(spare, { holder: p.id, owner: p.id, state: 'worn' });
  const what = nameOf(ctx, spare['kind'] as string);
  const line = ctx.emit('people.changed', {
    causes: [spare['made'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: `${spare['quality']} ${what}`,
      why: old
        ? `the old ${nameOf(ctx, old['kind'] as string)} was worn thin`
        : 'the old one had worn through',
    },
  });
  if (spare['quality'] === content.clothes.worth[0]!.id)
    addMemory(ctx, p.id, content.clothes.memories.fine, line);
  return stop(p);
}
