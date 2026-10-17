import type { Tuning } from './types.ts';

export interface Clock {
  day: number;
  hour: number;
  minute: number;
}

export function clockAt(tick: number, tuning: Tuning): Clock {
  const ofDay = tick % tuning.ticksPerDay;
  const hour = Math.floor(ofDay / tuning.ticksPerHour);
  const minute = Math.floor(((ofDay % tuning.ticksPerHour) * 60) / tuning.ticksPerHour);
  return { day: Math.floor(tick / tuning.ticksPerDay) + 1, hour, minute };
}

export function isNight(tick: number, tuning: Tuning): boolean {
  const { hour } = clockAt(tick, tuning);
  return hour >= tuning.nightStartHour || hour < tuning.nightEndHour;
}
