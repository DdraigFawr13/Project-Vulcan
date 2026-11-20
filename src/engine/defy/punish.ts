// The Punishment law at work (P6.5's law, given something to punish in P6.7, V-160). Someone
// caught taking or brawling is sentenced by the setting in force (laws.json `punish`, one of the
// sentences in defy.json `punish`, so a new sentence is a data entry): its `day` (the next day
// worked to bedtime, `work`, or sat on the green, `green`), a `memory` they keep (the stocks'
// shame), or `leave`, sent out of the valley that day. Under a setting with no `punish` nothing
// is done. A sentence served brings its keeper down one step
// of the ladder, to climb again only after its hold (6A review). Whoever refuses the law and saw
// the act remembers the sentence as wrong, which leans them further against it.
import { TICKS_PER_DAY, type EntityRow, type LawDef, type LawSettingDef } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { settingOf } from '../law/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stepDown } from './ladder.ts';
import { leave } from './leave.ts';
import { defyOf, leavingOf } from './tables.ts';

/** The law whose settings punish, and its setting in force. */
function punishing(ctx: SystemContext): { def: LawDef; s: LawSettingDef } | undefined {
  const def = ctx.content.laws.laws.find((d) => d.settings.some((s) => s.punish));
  if (!def) return undefined;
  return { def, s: settingOf(ctx.world, ctx.content, def.id) };
}

/** `p`, caught at line `cause` by `saw`, is sentenced. */
export function punish(ctx: SystemContext, p: EntityRow, cause: number, saw: EntityRow[]): void {
  const { world, content } = ctx;
  const law = punishing(ctx);
  if (!law?.s.punish || p['status'] !== 'alive' || leavingOf(world, p.id)) return;
  const kind = law.s.punish;
  const sentence = content.defy.punish[kind]!;
  const set = (world.entities['law'] ?? []).find((r) => r['law'] === law.def.id)?.['line'];
  const line = ctx.emit('defy.punished', {
    causes: [cause, set as number].filter((l) => typeof l === 'number' && l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, sentence: sentence.text, days: law.s.days },
  });
  const day = Math.floor(world.tick / TICKS_PER_DAY) + 1;
  if (sentence.leave) leave(ctx, p, undefined, {}, line);
  else {
    addEntity(world, 'sentence', { person: p.id, kind, day, line });
    const row = defyOf(world, p.id);
    if (row && (row['step'] as number) > 0) stepDown(ctx, p, row);
  }
  if (sentence.memory) addMemory(ctx, p.id, sentence.memory, line);
  const by = new Set(saw.map((q) => q.id));
  for (const a of world.entities['answer'] ?? [])
    if (a['law'] === law.def.id && a['answer'] === 'refuses' && by.has(a['person'] as number))
      addMemory(ctx, a['person'] as number, content.defy.memories['unfair']!, line, p.id);
}
