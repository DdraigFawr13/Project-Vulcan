// The Hearths law at the hearth (6B, P6.10): how each tender keeps a fire follows their own answer
// to it. A keeper of Frugal or Roaring tends by its `hearth` numbers (laws.json); Steady, the
// custom, is work.json `fire.tend`. A refuser tends the old way, and feeding a fire is then a
// `law.keptCustom` line those who see it remember; a cold grumbler under a setting that banks
// stokes their fire the old way anyway, with a `fire.stoked` line. Each is said at most once in
// `laws.answer.every` days a person.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type LawSettingDef,
  type WorldState,
} from '../core/index.ts';
import { placeOf } from '../fire/index.ts';
import { answerTo, flout, lawDef, settingOf } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const HEARTHS = 'hearths';

/** How `p` tends: fuel `top` and `topBelow` (minutes), degrees `below` added to the hearth line,
 * whether they bank at night, whether `below` holds even when they are cold (`strict`), and the
 * answer whose line a fire they feed would be (`flout` for a refuser, `stoke` for a cold
 * grumbler). */
export interface TendRule {
  top: number;
  topBelow: number;
  below: number;
  bank: boolean;
  strict: boolean;
  flout?: { s: LawSettingDef; a: EntityRow };
  stoke?: { s: LawSettingDef; a: EntityRow };
}

/** `p`'s tending under the Hearths law in force; `cold` when they tend for their own warmth. */
export function tendRule(
  world: WorldState,
  content: EngineContent,
  p: EntityRow,
  cold = false,
): TendRule {
  const t = content.work.fire.tend;
  const custom: TendRule = {
    top: t.top,
    topBelow: t.topBelow,
    below: 0,
    bank: true,
    strict: false,
  };
  if (!lawDef(content, HEARTHS)) return custom;
  const s = settingOf(world, content, HEARTHS);
  const a = s.hearth ? answerTo(world, HEARTHS, p.id) : undefined;
  if (!s.hearth || !a) return custom;
  if (a['answer'] === 'refuses') return { ...custom, flout: { s, a } };
  if (a['answer'] === 'grumbles' && cold && s.hearth.bank) return { ...custom, stoke: { s, a } };
  return { ...s.hearth, strict: true };
}

/** Whether `p` banks the fire that warms their bed for the night. */
export const banks = (world: WorldState, content: EngineContent, p: EntityRow): boolean =>
  tendRule(world, content, p).bank;

/** After `p` fed `piece`'s fire by `rule`: the refuser's or cold grumbler's line, at most once in
 * `answer.every` days (the answer's `flouted`). */
export function fedPastLaw(
  ctx: SystemContext,
  p: EntityRow,
  piece: EntityRow,
  rule: TendRule,
): void {
  const by = rule.flout ?? rule.stoke;
  if (!by) return;
  const last = (by.a['flouted'] as number | undefined) ?? -1;
  if (last >= 0 && ctx.world.tick < last + ctx.content.laws.answer.every * TICKS_PER_DAY) return;
  by.a['flouted'] = ctx.world.tick;
  const where = placeOf(ctx.world, ctx.content, piece).where;
  if (rule.flout) {
    flout(ctx, by.s, by.a, p, `fed the fire ${where} the old way`);
    return;
  }
  ctx.emit('fire.stoked', {
    causes: [by.a['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, where, days: by.s.days },
  });
}
