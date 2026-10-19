// The law system (P4.8, V-091): owns each law's setting and the band's answers. The `setLaw` lever
// is the player's only say; everyone weighs it themselves. Each hour it sees whether a held memory
// changes an answer, and at the hour a refuser's day differs from the law's, it writes that they
// kept the customary hours and who saw it, who then remember it (and may lean the same way).
import { clockAt, type EntityRow, type LawSettingDef } from '../core/index.ts';
import { houseAt } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { addMemory } from '../needs/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { answerAll, answersOf, LAW_TABLES, reweigh } from './answer.ts';
import { customaryHours, hoursFor, lawDef, lawRow, settingOf } from './hours.ts';

const hh = (h: number): string => `${String(h % 24).padStart(2, '0')}:00`;

const list = (names: string[]): string =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`;

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

/** Whether `q` can see `p` keep the customary hours: the same level within sight, or the same house. */
function sees(ctx: SystemContext, p: EntityRow, q: EntityRow): boolean {
  const at = (r: EntityRow, k: string) => r[k] as number;
  if (at(p, 'z') !== at(q, 'z')) return false;
  const far = Math.max(Math.abs(at(p, 'x') - at(q, 'x')), Math.abs(at(p, 'y') - at(q, 'y')));
  if (far <= ctx.content.laws.answer.sight) return true;
  if (at(p, 'z') !== 0) return false;
  const house = houseAt(ctx.world, at(p, 'x'), at(p, 'y'));
  return !!house && house === houseAt(ctx.world, at(q, 'x'), at(q, 'y'));
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
    const kept = ctx.emit('law.keptCustom', {
      causes: [a['line'] as number],
      actors: [p.id],
      data: { name: p['name'] as string, did, days: s.days },
    });
    const saw = people.filter(
      (q) => q.id !== p.id && q['status'] === 'alive' && q['doing'] !== 'sleep' && sees(ctx, p, q),
    );
    if (!saw.length || !s.saw) continue;
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
      if (!s.hours) continue;
      partings(ctx, def.id, s, hour);
      reweigh(ctx, def.id, s);
    }
  },
};
