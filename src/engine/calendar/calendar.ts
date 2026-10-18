// The calendar's ledger lines: a line each new day, a month line on the first of each month and
// a season line when a season turns; the world's first month and season get theirs when it
// begins. Day lines cite their month line and month lines the world's beginning, so any "why?"
// reaches the start in two steps.
import { clockAt, TICKS_PER_DAY } from '../core/index.ts';
import type { System, SystemContext } from '../sim/index.ts';

/** Writes the month line, and the season line when `turned`, for the day the clock is on. */
function openMonth(ctx: SystemContext, turned: boolean): void {
  const { calendar } = ctx.content;
  const clock = clockAt(ctx.world.tick, calendar);
  const monthEvent = ctx.emit('calendar.month', {
    causes: [ctx.world.begunEvent],
    data: { month: calendar.monthNames[clock.month]!, year: clock.year },
  });
  ctx.state['monthEvent'] = monthEvent;
  if (turned) {
    const season = calendar.seasons[clock.season]!;
    ctx.emit('calendar.season', {
      causes: [monthEvent],
      data: { season, seasonName: season.charAt(0).toUpperCase() + season.slice(1) },
    });
  }
}

export const calendarSystem: System = {
  id: 'calendar',
  every: 'day',
  emits: ['calendar.day', 'calendar.month', 'calendar.season'],
  initialState: { monthEvent: 0 },
  refs: ['monthEvent'],
  init(ctx) {
    openMonth(ctx, true);
  },
  run(ctx) {
    const { calendar } = ctx.content;
    const clock = clockAt(ctx.world.tick, calendar);
    const month = calendar.monthNames[clock.month]!;
    if (clock.day > 1) {
      const cause = ctx.state['monthEvent'] || ctx.world.begunEvent;
      ctx.emit('calendar.day', { causes: [cause], data: { day: clock.day, month } });
      return;
    }
    // A season turns when this month's season differs from the last month's (clockAt decides both).
    openMonth(ctx, clock.season !== clockAt(ctx.world.tick - TICKS_PER_DAY, calendar).season);
  },
};
