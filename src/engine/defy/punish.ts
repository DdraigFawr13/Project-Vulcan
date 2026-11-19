// The Punishment law at work (P6.5's law, given something to punish in P6.7, V-160). Someone
// caught taking or brawling is sentenced by the setting in force (laws.json `punish`): `work`,
// the next day worked to bedtime with no leisure; `stocks`, the next day sat on the green (they
// keep its shame, defy.json `memories.stocks`); `away`, sent out of the valley that day. Under a
// setting with no `punish` nothing is done. Whoever refuses the law remembers a sentence as
// wrong, which leans them further against it.
import { TICKS_PER_DAY, type EntityRow, type LawDef, type LawSettingDef } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { settingOf } from '../law/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { leave } from './leave.ts';

/** The law whose settings punish, and its setting in force. */
function punishing(ctx: SystemContext): { def: LawDef; s: LawSettingDef } | undefined {
  const def = ctx.content.laws.laws.find((d) => d.settings.some((s) => s.punish));
  if (!def) return undefined;
  return { def, s: settingOf(ctx.world, ctx.content, def.id) };
}

/** `p`, caught at line `cause`, is sentenced. */
export function punish(ctx: SystemContext, p: EntityRow, cause: number): void {
  const { world, content } = ctx;
  const law = punishing(ctx);
  if (!law?.s.punish) return;
  const kind = law.s.punish;
  const set = (world.entities['law'] ?? []).find((r) => r['law'] === law.def.id)?.['line'];
  const line = ctx.emit('defy.punished', {
    causes: [cause, set as number].filter((l) => typeof l === 'number' && l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, sentence: content.defy.punish[kind], days: law.s.days },
  });
  const day = Math.floor(world.tick / TICKS_PER_DAY) + 1;
  if (kind === 'away') leave(ctx, p, undefined, {}, line);
  else addEntity(world, 'sentence', { person: p.id, kind, day, line });
  if (kind === 'stocks') addMemory(ctx, p.id, content.defy.memories['stocks']!, line);
  for (const a of world.entities['answer'] ?? [])
    if (a['law'] === law.def.id && a['answer'] === 'refuses' && a['person'] !== p.id)
      addMemory(ctx, a['person'] as number, content.defy.memories['unfair']!, line, p.id);
}
