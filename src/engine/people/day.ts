// The colony's day (P2.5): one timetable for everyone, a lever since P2.5 and the ground Phase 4's
// work-hours law grows from. Work runs from `workFrom` to `workTo` o'clock, free time until
// `sleepFrom`, and night until work starts again. It starts as content's `work.hours` and
// `life.sleep.from`; the `setDay` lever changes it with a line.
import type { EngineContent, WorldState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';

export interface Day {
  workFrom: number;
  workTo: number;
  sleepFrom: number;
}

/** The colony's day now. */
export function dayOf(world: WorldState, content: EngineContent): Day {
  const state = world.systems['people'] ?? {};
  return {
    workFrom: state['workFrom'] ?? content.work.hours.from,
    workTo: state['workTo'] ?? content.work.hours.to,
    sleepFrom: state['sleepFrom'] ?? content.life.sleep.from,
  };
}

const hh = (h: number): string => `${String(h % 24).padStart(2, '0')}:00`;

/** The `setDay` lever: `{ workFrom, workTo, sleepFrom }`, whole hours with work before bed. */
export function setDay(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
): void {
  const { workFrom, workTo, sleepFrom } = data as Partial<Record<keyof Day, number>>;
  const whole = [workFrom, workTo, sleepFrom].every((h) => Number.isSafeInteger(h));
  if (
    !whole ||
    !(workFrom! >= 1 && workFrom! < workTo! && workTo! <= sleepFrom! && sleepFrom! <= 24)
  ) {
    ctx.emit('command.refused', {
      causes: [cause],
      data: {
        kind: 'setDay',
        reason: 'work must start after midnight, end after it starts and end by bedtime',
      },
    });
    return;
  }
  const now = dayOf(ctx.world, ctx.content);
  if (now.workFrom === workFrom && now.workTo === workTo && now.sleepFrom === sleepFrom) return;
  Object.assign(ctx.state, { workFrom, workTo, sleepFrom });
  ctx.state['dayLine'] = ctx.emit('work.daySet', {
    causes: [cause],
    data: { from: hh(workFrom!), to: hh(workTo!), sleep: hh(sleepFrom!) },
  });
}
