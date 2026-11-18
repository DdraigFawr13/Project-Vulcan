// A hungry winter breaks new ground (5B proposal 1, V-162). Each winter day at `hungry.hour` the
// colony counts a day when the store's food is under its plate. On the first such hour after
// winter, a winter with at least `hungry.days` of them raises the field tiles each mouth needs
// by `hungry.more`, up to `hungry.most` more in all, with a line naming the days; planFields
// then lays out the new ground in spring. Nobody is told where: the Fields row still decides.
import { clockAt } from '../core/index.ts';
import { haveOf, wantOf as plateOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Extra field tiles a mouth the colony wants after its hungry winters. */
export const moreOf = (state: Readonly<Record<string, number>>): number => state['fieldMore'] ?? 0;

/** Hourly, from the build system: counts the winter's short days, and weighs them after it. */
export function hungryWinter(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const h = content.buildings.field.hungry;
  const c = clockAt(world.tick, content.calendar);
  if (c.hour !== h.hour || c.minute !== 0) return;
  if (content.calendar.seasons[c.season] === 'winter') {
    state['winterOn'] = 1;
    if (haveOf(world, content, 'food') >= plateOf(world, content, 'food')) return;
    state['hungryDays'] = (state['hungryDays'] ?? 0) + 1;
    // The first hungry person's food line this winter, for "why?".
    if (!state['hungryLine']) {
      const low = (world.entities['need'] ?? []).find((n) => n['need'] === 'food' && n['low']);
      if (low?.['line']) state['hungryLine'] = low['line'] as number;
    }
    return;
  }
  if (!state['winterOn']) return;
  const days = state['hungryDays'] ?? 0;
  const cause = state['hungryLine'] ?? 0;
  Object.assign(state, { winterOn: 0, hungryDays: 0, hungryLine: 0 });
  const more = moreOf(state);
  if (days < h.days || more >= h.most) return;
  const now = Math.min(h.most, more + h.more);
  state['fieldMore'] = now;
  // It stands in for the field.needed line: the new field's line cites it.
  state['fieldNeed'] = ctx.emit('field.hungryWinter', {
    causes: cause ? [cause] : [],
    data: { days, more: now - more, per: content.buildings.field.perMouth + now },
  });
}
