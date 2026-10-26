// Daylight by month (P5.13, V-135): first light and dusk come from content's mid-month values,
// blended day by day towards the next month's, so the days draw out and in without a jump.
import { TICKS_PER_DAY, type EngineContent } from '../core/index.ts';

export interface Daylight {
  /** First light and dusk, in minutes of the day. */
  dawn: number;
  dusk: number;
}

/** First light and dusk on the day of `tick`. */
export function daylightAt(content: EngineContent, tick: number): Daylight {
  const { daysPerMonth, monthsPerYear } = content.calendar;
  const table = content.lamp.daylight;
  const days = Math.floor(tick / TICKS_PER_DAY) % (daysPerMonth * monthsPerYear);
  const month = Math.floor(days / daysPerMonth);
  // How far from the middle of the month, -0.5 to 0.5, and the neighbour month blended towards.
  const off = ((days % daysPerMonth) + 0.5) / daysPerMonth - 0.5;
  const next = (month + (off < 0 ? monthsPerYear - 1 : 1)) % monthsPerYear;
  const t = Math.abs(off);
  const [a, b] = [table[month]!, table[next]!];
  const at = (k: number) => Math.round((a[k]! + (b[k]! - a[k]!) * t) * 60);
  return { dawn: at(0), dusk: at(1) };
}

/** Whether it is dark on the surface at `tick`: before first light or from dusk. */
export function isDark(content: EngineContent, tick: number): boolean {
  const { dawn, dusk } = daylightAt(content, tick);
  const minute = tick % TICKS_PER_DAY;
  return minute < dawn || minute >= dusk;
}

/** The tick of the next first light after `tick`. */
export function nextDawn(content: EngineContent, tick: number): number {
  const start = tick - (tick % TICKS_PER_DAY);
  const today = start + daylightAt(content, tick).dawn;
  return today > tick
    ? today
    : start + TICKS_PER_DAY + daylightAt(content, start + TICKS_PER_DAY).dawn;
}
