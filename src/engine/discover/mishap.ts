// Mishaps (6C Slice 5, V-218): 1 in the New Ways setting's `mishap` work hints goes wrong. At a
// trade worked at a fire (`hot`), a burned hand (a light wound) at `mishap.hand` per cent or a
// small fire at `mishap.fire` per cent; else, and at other trades, the work spoils materials:
// one of the first of the way's `ruins` lying in a store (a fire burns one too). Nobody is
// killed. Each is a `discover.mishap` line (a tale) and a memory.
import { pronouns, type EntityRow } from '../core/index.ts';
import { itemsOf, inStore, takeFrom } from '../goods/index.ts';
import { wound } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fill, wayOf } from './find.ts';

/** One of the first of `kinds` lying in a store, taken; its name, else ''. */
function spoil(ctx: SystemContext, kinds: readonly string[]): string {
  const { world, content } = ctx;
  for (const kind of kinds) {
    const item = itemsOf(world).find(
      (i) =>
        i['kind'] === kind &&
        !i['owner'] &&
        inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
    );
    if (!item) continue;
    takeFrom(world, item, 1);
    return content.items.find((d) => d.id === kind)?.name ?? kind;
  }
  return '';
}

/** A work hint on `puzzle` (its line `hint`) going wrong. */
export function mishap(ctx: SystemContext, puzzle: EntityRow, p: EntityRow, hint: number): void {
  const { content } = ctx;
  const m = wayOf(ctx, puzzle);
  const d = content.methods.mishap;
  const roll = ctx.rng().int(100);
  const kind =
    m.hot && roll < d.hand ? 'hand' : m.hot && roll < d.hand + d.fire ? 'fire' : 'ruined';
  const what = kind === 'hand' ? '' : spoil(ctx, m.ruins) || d.nothing;
  const went = fill(d.words[kind], { what, ...pronouns(p) });
  const line = ctx.emit('discover.mishap', {
    causes: [hint],
    actors: [p.id],
    data: { name: p['name'] as string, where: m.where, went, method: m.name, kind },
  });
  addMemory(ctx, p.id, content.methods.memories.mishap, line);
  if (kind !== 'hand') return;
  const b = d.burn;
  wound(
    ctx,
    p,
    {
      ...{ part: b.parts[ctx.rng().int(b.parts.length)]!, kind: 'burn', severity: b.severity },
      ...{ what: b.what, where: m.where, place: b.at },
    },
    [line],
    false,
  );
}
