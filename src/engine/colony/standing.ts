// The colony's standing (P6.6, V-158): one trust number, 0 to 100, from its start plus the causes
// still counting. Fed winters, kept laws and answered petitions raise it; harsh laws in hard
// times and petitions let stand or ignored lower it; an elder's death shakes it for a season.
// Each cause is a line and a row that stops counting after its days.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type StandingCause,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity, alive } from '../entity/index.ts';
import { foodDays, foodGoneLine, storeLasts } from '../goods/index.ts';
import { isWinter, lawRow, settingOf } from '../law/index.ts';
import { memoriesOf, needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { causesOf, colonyRow } from './tables.ts';

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

/** Works the standing out again from its causes. */
export function settle(ctx: SystemContext): number {
  const { world, content } = ctx;
  const sum = causesOf(world).reduce((n, c) => n + (c['by'] as number), 0);
  const value = clamp(content.colony.standing.start + sum);
  const row = colonyRow(world);
  if (row) row['standing'] = value;
  return value;
}

/** Adds a cause of standing, `by` points for `days`, with a line citing `causes`. */
export function addCause(
  ctx: SystemContext,
  kind: string,
  def: { by: number; days: number },
  text: string,
  causes: number[],
): number {
  const until = ctx.world.tick + def.days * TICKS_PER_DAY;
  // The line states what standing will be once this cause counts, from all the causes (6A review).
  const sum = causesOf(ctx.world).reduce((n, c) => n + (c['by'] as number), def.by);
  const now = clamp(ctx.content.colony.standing.start + sum);
  const line = ctx.emit('colony.standing', {
    causes,
    data: {
      text: text.charAt(0).toUpperCase() + text.slice(1),
      way: def.by > 0 ? 'rises' : 'falls',
      standing: now,
      cause: kind,
    },
  });
  addEntity(ctx.world, 'cause', { cause: kind, by: def.by, text, line, until });
  settle(ctx);
  return line;
}

/** Drops the causes whose days are over. */
export function expire(ctx: SystemContext): void {
  const gone = causesOf(ctx.world).filter((c) => (c['until'] as number) <= ctx.world.tick);
  for (const c of gone) removeEntity(ctx.world, 'cause', c.id);
  if (gone.length) settle(ctx);
}

/** Hard times: winter, or a store that will not last to the harvest. */
export const hardTimes = (world: WorldState, content: EngineContent): boolean =>
  isWinter(world, content) || !storeLasts(world, content, 0);

/** Every `every` days: the laws kept by most raise it; each harsh setting in hard times lowers
 * it by its `harsh`. */
export function weekly(ctx: SystemContext, day: number): void {
  const { world, content } = ctx;
  const { kept, harsh } = content.colony.standing;
  if (day % kept.every === 0) {
    const answers = (world.entities['answer'] ?? []).filter((a) =>
      alive(world).some((p) => p.id === a['person']),
    );
    const keep = answers.filter((a) => a['answer'] === 'obeys');
    if (answers.length && keep.length * 100 >= kept.share * answers.length)
      addCause(
        ctx,
        'kept',
        kept,
        kept.text,
        keep.slice(-3).map((a) => a['line'] as number),
      );
  }
  storeOut(ctx, day);
  if (day % harsh.every !== 0 || !hardTimes(world, content)) return;
  for (const def of content.laws.laws) {
    const s = settingOf(world, content, def.id);
    if (!s.harsh) continue;
    const set = lawRow(world, def.id)?.['line'] as number | undefined;
    const cause: StandingCause = { by: -s.harsh, days: harsh.days, text: harsh.text };
    addCause(ctx, 'harsh', cause, harsh.text.replace('{days}', s.days), set ? [set] : []);
  }
}

/** Every `storeOut.every` days: an empty store while someone goes hungry lowers standing, at any
 * law (6A review P2). The line cites the last food eaten, when the band ran out of it. */
function storeOut(ctx: SystemContext, day: number): void {
  const { world, content } = ctx;
  const out = content.colony.standing.storeOut;
  if (day % out.every !== 0) return;
  const band = alive(world);
  if (!band.length || foodDays(world, content, band.length).days > out.food) return;
  const hungry = band
    .map((p) => memoriesOf(world, p.id).find((m) => m['memory'] === out.hungry))
    .filter((m) => m !== undefined);
  if (!hungry.length) return;
  const gone = foodGoneLine(world);
  const causes = [gone, ...hungry.slice(-2).map((m) => m['line'] as number)];
  addCause(ctx, 'storeOut', out, out.text, [...new Set(causes.filter((l) => l > 0))]);
}

/** Counts the hungry each winter day; at its end, a winter with at most `most` hungry days a
 * person is a fed winter. */
export function winterTally(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const { fedWinter } = content.colony.standing;
  const winter = isWinter(world, content);
  const band = alive(world);
  if (winter) {
    state['winter'] = 1;
    state['hungry'] =
      (state['hungry'] ?? 0) + band.filter((p) => needOf(world, p.id, 'food')?.['low']).length;
    state['people'] = Math.max(state['people'] ?? 0, band.length);
    return;
  }
  if (!state['winter']) return;
  const fed = (state['hungry'] ?? 0) <= fedWinter.most * (state['people'] ?? 0);
  state['winter'] = 0;
  state['hungry'] = 0;
  state['people'] = 0;
  if (!fed || !band.length) return;
  const spring = world.log.findLast((e) => e.type === 'calendar.season');
  addCause(ctx, 'fedWinter', fedWinter, fedWinter.text, spring ? [spring.id] : []);
}
