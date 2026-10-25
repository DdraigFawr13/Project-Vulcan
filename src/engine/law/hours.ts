// Whose hours are whose (P4.8, V-091, V-092): the work-hours law sets the colony's hours, in
// winter its own; Customary is the colony's own day (content's `work.hours`), short in
// winter. Someone who refuses the law keeps the customary hours.
import {
  clockAt,
  type EngineContent,
  type EntityRow,
  type LawDef,
  type LawSettingDef,
  type WorldState,
} from '../core/index.ts';

export interface Hours {
  workFrom: number;
  workTo: number;
  sleepFrom: number;
}

export const WORK_HOURS = 'work-hours';

/** The law's row, once its setting was first changed. */
export const lawRow = (world: WorldState, law: string): EntityRow | undefined =>
  (world.entities['law'] ?? []).find((r) => r['law'] === law);

export const lawDef = (content: EngineContent, law: string): LawDef | undefined =>
  content.laws.laws.find((l) => l.id === law);

/** The setting a law has now: its row's, else the law's start. */
export function settingOf(world: WorldState, content: EngineContent, law: string): LawSettingDef {
  const def = lawDef(content, law)!;
  const id = (lawRow(world, law)?.['setting'] as string | undefined) ?? def.start;
  return def.settings.find((s) => s.id === id) ?? def.settings[0]!;
}

/** The custom: the setting with no hours of its own. */
export const customOf = (def: LawDef): LawSettingDef | undefined =>
  def.settings.find((s) => !s.hours);

export function isWinter(world: WorldState, content: EngineContent): boolean {
  const { calendar } = content;
  return calendar.seasons[clockAt(world.tick, calendar).season] === 'winter';
}

/** The customary hours this season. */
export function customaryHours(world: WorldState, content: EngineContent): Hours {
  const sleepFrom = content.life.sleep.from;
  const custom = customOf(lawDef(content, WORK_HOURS)!);
  const h = (custom && isWinter(world, content) && custom.winter) || content.work.hours;
  return { workFrom: h.from, workTo: h.to, sleepFrom };
}

/** A setting's hours this season (the customary ones for the custom). */
export function hoursFor(world: WorldState, content: EngineContent, s: LawSettingDef): Hours {
  if (!s.hours) return customaryHours(world, content);
  const h = (isWinter(world, content) && s.winter) || s.hours;
  const sleepFrom = customaryHours(world, content).sleepFrom;
  return { workFrom: h.from, workTo: Math.min(h.to, sleepFrom), sleepFrom };
}

/** The hours the work-hours law sets now, for everyone who keeps it. */
export const lawHours = (world: WorldState, content: EngineContent): Hours =>
  hoursFor(world, content, settingOf(world, content, WORK_HOURS));

/** A person's own hours: the law's, or the customary ones when they refuse it. */
export function hoursOf(world: WorldState, content: EngineContent, person: number): Hours {
  const refuses = (world.entities['answer'] ?? []).some(
    (a) => a['person'] === person && a['law'] === WORK_HOURS && a['answer'] === 'refuses',
  );
  return refuses ? customaryHours(world, content) : lawHours(world, content);
}
