// The New Ways law (6C Slice 5, V-218): Old ways only, Allowed (the custom) or Encouraged, each
// setting's `ways` read per person; a refuser keeps the custom. With no such law in content,
// puzzles start, luck comes, work hints take `methods.work` hours and nothing goes wrong.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { answerTo, lawDef, settingOf } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { puzzleOf } from './tables.ts';
import { wayOf } from './find.ts';

export const NEW_WAYS = 'new-ways';

export interface Ways {
  start: boolean;
  luck: boolean;
  work: number;
  mishap: number;
  trying: number;
}

/** How `person` keeps the New Ways law now. */
export function waysOf(world: WorldState, content: EngineContent, person: number): Ways {
  const def = lawDef(content, NEW_WAYS);
  const plain = { start: true, luck: true, work: content.methods.work, mishap: 0, trying: 0 };
  if (!def) return plain;
  const custom = def.settings.find((s) => s.id === def.start);
  const refuses = answerTo(world, NEW_WAYS, person)?.['answer'] === 'refuses';
  return (refuses ? custom : settingOf(world, content, NEW_WAYS))?.ways ?? custom?.ways ?? plain;
}

/** Under a `trying` setting, one working minute in `trying` at their puzzle's trade is spent
 * trying the new way and does no work (people `mind.ts` asks). */
export function trying(ctx: SystemContext, p: EntityRow): boolean {
  const q = puzzleOf(ctx.world, p.id);
  if (!q || wayOf(ctx, q).job !== p['job']) return false;
  const every = waysOf(ctx.world, ctx.content, p.id).trying;
  return every > 0 && (ctx.world.tick + p.id) % every === 0;
}
