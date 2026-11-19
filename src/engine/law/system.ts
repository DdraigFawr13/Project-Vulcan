// The law system (P4.8, V-091): owns each law's setting and the band's answers. The `setLaw` lever
// is the player's only say; everyone weighs it themselves. Each hour it sees whether a held memory
// changes an answer, and at the hour a refuser's day differs from the law's, it writes that they
// kept the customary hours and who saw it, who then remember it (and may lean the same way).
import { clockAt, type LawSettingDef } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { addMemory } from '../needs/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { answerAll, answered, answersOf, LAW_TABLES, reweigh } from './answer.ts';
import { flout } from './flout.ts';
import { rationsHour } from './rations.ts';
import { customaryHours, hoursFor, lawDef, lawRow, settingOf } from './hours.ts';

const hh = (h: number): string => `${String(h % 24).padStart(2, '0')}:00`;

/** The `setLaw` lever: `{ law, setting }`. */
function setLaw(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number): void {
  const { law, setting } = data as { law?: string; setting?: string };
  const def = typeof law === 'string' ? lawDef(ctx.content, law) : undefined;
  const s = def?.settings.find((x) => x.id === setting);
  if (!def || !s) {
    ctx.emit('command.refused', {
      causes: [cause],
      data: { kind: 'setLaw', reason: 'no such law or setting' },
    });
    return;
  }
  if (settingOf(ctx.world, ctx.content, def.id).id === s.id) return;
  const line = ctx.emit('law.set', { causes: [cause], data: { law: def.law, setting: s.name } });
  const row = lawRow(ctx.world, def.id);
  const fields = { setting: s.id, line, changed: ctx.world.tick };
  if (row) Object.assign(row, fields);
  else addEntity(ctx.world, 'law', { law: def.id, ...fields });
  answerAll(ctx, def.id, s, line);
}

/** At the hour a refuser's day and the law's part, they keep the customary hours with a line;
 * whoever sees it remembers it. A grumbler's day ends with the memory of it refreshed. */
function partings(ctx: SystemContext, law: string, s: LawSettingDef, hour: number): void {
  const { world, content } = ctx;
  const mine = hoursFor(world, content, s);
  const custom = customaryHours(world, content);
  const people = world.entities['person'] ?? [];
  const parts = mine.workTo > custom.workTo ? custom.workTo : mine.workTo;
  if (hour === mine.workTo && s.grumbled)
    for (const a of answersOf(ctx, law).filter((r) => r['answer'] === 'grumbles'))
      addMemory(ctx, a['person'] as number, s.grumbled, a['line'] as number);
  if (hour !== parts || mine.workTo === custom.workTo) return;
  for (const a of answersOf(ctx, law).filter((r) => r['answer'] === 'refuses')) {
    const p = people.find((q) => q.id === a['person']);
    if (!p || p['status'] !== 'alive' || p['doing'] === 'sleep') continue;
    const did =
      mine.workTo > custom.workTo
        ? `downed tools at ${hh(custom.workTo)} and went home`
        : `worked on past ${hh(mine.workTo)}`;
    flout(ctx, s, a, p, did);
  }
}

export const lawSystem: System = {
  id: 'law',
  every: 'hour',
  emits: ['law.set', 'law.answered', 'law.keptCustom', 'law.saw'],
  tables: LAW_TABLES,
  commands: { setLaw: (ctx, command, cause) => setLaw(ctx, command.data, cause) },
  run(ctx) {
    const hour = clockAt(ctx.world.tick, ctx.content.calendar).hour;
    for (const def of ctx.content.laws.laws) {
      const s = settingOf(ctx.world, ctx.content, def.id);
      if (!answered(ctx, def.id, s)) continue;
      if (s.hours) partings(ctx, def.id, s, hour);
      if (s.share) rationsHour(ctx, def.id, s);
      reweigh(ctx, def.id, s);
    }
  },
};
