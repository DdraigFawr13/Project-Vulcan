// Game time from a tick count: one tick is one game minute (docs/ARCHITECTURE.md "Tick").
import type { CalendarDef } from './types.ts';

export const TICKS_PER_HOUR = 60;
export const TICKS_PER_DAY = 1440;
/** A new world starts at 06:00 on the first day of the first month of year 1. */
export const START_TICK = 6 * TICKS_PER_HOUR;

export interface Clock {
  year: number;
  /** 0-based month of the year. */
  month: number;
  /** 1-based day of the month. */
  day: number;
  hour: number;
  minute: number;
  /** 0-based season, each spanning an equal share of the months. */
  season: number;
}

export const ticksPerMonth = (calendar: CalendarDef): number =>
  calendar.daysPerMonth * TICKS_PER_DAY;

export function clockAt(tick: number, calendar: CalendarDef): Clock {
  const days = Math.floor(tick / TICKS_PER_DAY);
  const months = Math.floor(days / calendar.daysPerMonth);
  const month = months % calendar.monthsPerYear;
  const ofDay = tick % TICKS_PER_DAY;
  return {
    year: Math.floor(months / calendar.monthsPerYear) + 1,
    month,
    day: (days % calendar.daysPerMonth) + 1,
    hour: Math.floor(ofDay / TICKS_PER_HOUR),
    minute: ofDay % TICKS_PER_HOUR,
    season: Math.floor((month * calendar.seasons.length) / calendar.monthsPerYear),
  };
}
