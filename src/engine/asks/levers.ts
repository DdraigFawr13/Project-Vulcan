// The asks' levers (6C Slice 3, V-225, V-041): `takeAsk {ask, level}` takes an ask up at a
// priority of 1 to 4 (or moves a taken one), `passAsk {ask}` lets it pass. Both answer as the
// colony and name nobody; both work while paused, as every lever does.
import type { SystemContext } from '../sim/index.ts';
import { giveBack } from './asks.ts';

const live = (ctx: SystemContext, id: unknown) =>
  (ctx.world.entities['ask'] ?? []).find(
    (a) => a.id === id && ['open', 'taken', 'passed'].includes(a['state'] as string),
  );

const refuse = (ctx: SystemContext, kind: string, reason: string, cause: number) =>
  ctx.emit('command.refused', { causes: [cause], data: { kind, reason } });

/** `takeAsk {ask, level}`: taken up at `level`; a taken ask moves to it. */
export function takeAsk(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
) {
  const words = ctx.content.work.priority.words;
  const level = data['level'] as number;
  const a = live(ctx, data['ask']);
  if (!a || !Number.isSafeInteger(level) || level < 1 || level > words.length)
    return refuse(ctx, 'takeAsk', 'no such ask open, or no such level', cause);
  if (a['state'] === 'taken' && a['level'] === level) return;
  const line = ctx.emit('ask.taken', {
    causes: [cause, a['line'] as number],
    data: {
      ...{ what: a['what'] as string, asker: a['asker'] as string },
      now: a['state'] === 'taken' ? 'now ' : '',
      word: words[level - 1]!,
    },
  });
  Object.assign(a, { state: 'taken', level, answer: line });
}

/** `passAsk {ask}`: let pass; what it costs comes on its day. */
export function passAsk(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
) {
  const a = live(ctx, data['ask']);
  if (!a || a['state'] === 'passed') return refuse(ctx, 'passAsk', 'no such ask open', cause);
  const line = ctx.emit('ask.letPass', {
    causes: [cause, a['line'] as number],
    data: { what: a['what'] as string, asker: a['asker'] as string },
  });
  Object.assign(a, { state: 'passed', level: 0, answer: line, going: [] });
  // What was set apart goes back to the colony now, not on its day.
  giveBack(ctx, a, line);
}
