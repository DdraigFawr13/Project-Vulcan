// The calendar's ledger lines: a line each new day, a month line on the first of each month and
// a season line when a season turns. Day lines cite their month line and month lines the
// world's beginning, so any "why?" reaches the start in two steps.
import { clockAt } from '../core/index.ts';
import type { System } from '../sim/index.ts';

export const calendarSystem: System = {
  id: 'calendar',
  every: 'day',
  initialState: { monthEvent: 0 },
  run(ctx) {
    const { calendar } = ctx.content;
    const clock = clockAt(ctx.world.tick, calendar);
    const month = calendar.monthNames[clock.month] ?? `Month ${clock.month + 1}`;
    if (clock.day > 1) {
      const cause = ctx.state['monthEvent'] || ctx.world.begunEvent;
      ctx.emit('calendar.day', { causes: [cause], data: { day: clock.day, month } });
      return;
    }
    const monthEvent = ctx.emit('calendar.month', {
      causes: [ctx.world.begunEvent],
      data: { month, year: clock.year },
    });
    ctx.state['monthEvent'] = monthEvent;
    const monthsPerSeason = calendar.monthsPerYear / calendar.seasons.length;
    if (clock.month % monthsPerSeason === 0) {
      const season = calendar.seasons[clock.season] ?? `season ${clock.season + 1}`;
      ctx.emit('calendar.season', {
        causes: [monthEvent],
        data: { season, seasonName: season.charAt(0).toUpperCase() + season.slice(1) },
      });
    }
  },
};
