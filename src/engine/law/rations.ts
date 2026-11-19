// The Rations law (P6.5, V-157): Full plates is the custom; under Short or Hunger rations each
// person has the setting's `share` of a full day's food a day, kept as `left` on their answer and
// filled each midnight (what they ate past it the day before comes off). Whoever keeps the law
// eats only while some is left, so the store lasts longer and they go hungry. A refuser eats their
// fill, and eating past the share is a line (at most once in `answer.every` days) that those who
// see it remember. People
// mind.ts asks `rationed` before going to eat; eat.ts tells `ateFood` what each meal gave.
import {
  clockAt,
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type LawSettingDef,
  type WorldState,
} from '../core/index.ts';
import { addMemory, needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { answersOf } from './answer.ts';
import { flout } from './flout.ts';
import { lawDef, settingOf } from './hours.ts';
import { shareOf } from './share.ts';

export const RATIONS = 'rations';

/** The Rations setting in force, if the content has the law (some tests leave it out). */
const rationsOf = (world: WorldState, content: EngineContent) =>
  lawDef(content, RATIONS) ? settingOf(world, content, RATIONS) : undefined;

const answerOf = (world: WorldState, p: EntityRow): EntityRow | undefined =>
  (world.entities['answer'] ?? []).find((r) => r['person'] === p.id && r['law'] === RATIONS);

/** Whether `p` keeps the rations and has eaten all of today's share. */
export function rationed(world: WorldState, content: EngineContent, p: EntityRow): boolean {
  if (!rationsOf(world, content)?.share) return false;
  const a = answerOf(world, p);
  return !!a && a['answer'] !== 'refuses' && (a['left'] as number) <= 0;
}

/** After `p` ate food worth `gives`, it comes off their share; a refuser eating past it today
 * flouts the law. */
export function ateFood(ctx: SystemContext, p: EntityRow, gives: number): void {
  const s = rationsOf(ctx.world, ctx.content);
  const a = s?.share ? answerOf(ctx.world, p) : undefined;
  if (!s || !a) return;
  const before = a['left'] as number;
  a['left'] = before - gives;
  if (a['answer'] !== 'refuses' || before < 0 || before - gives >= 0) return;
  // Taking a full plate is a line at most once in `every` days; the plates between go unsaid.
  const last = (a['flouted'] as number | undefined) ?? -1;
  if (last >= 0 && ctx.world.tick < last + ctx.content.laws.answer.every * TICKS_PER_DAY) return;
  a['flouted'] = ctx.world.tick;
  flout(ctx, s, a, p, 'took a full plate');
}

/** Each hour: at midnight everyone's share is filled again. A keeper held back and hungry
 * remembers the short meals; a grumbler, that it was against their will. Both cite their answer. */
export function rationsHour(ctx: SystemContext, law: string, s: LawSettingDef): void {
  const { world, content } = ctx;
  const share = shareOf(ctx, s);
  const midnight = clockAt(world.tick, content.calendar).hour === 0;
  for (const a of answersOf(ctx, law)) {
    // A refuser owes nothing: their share starts afresh, so a full plate is a line each day.
    if (midnight)
      a['left'] =
        a['answer'] === 'refuses' ? share : Math.min(share, (a['left'] as number) + share);
    if (a['answer'] === 'refuses') continue;
    const p = (world.entities['person'] ?? []).find((q) => q.id === a['person']);
    if (!p || p['status'] !== 'alive' || !rationed(world, content, p)) continue;
    if (!needOf(world, p.id, 'food')?.['low']) continue;
    const line = a['line'] as number;
    if (s.kept) addMemory(ctx, p.id, s.kept, line);
    if (a['answer'] === 'grumbles' && s.grumbled) addMemory(ctx, p.id, s.grumbled, line);
  }
}
