// The health system (P5.6, P5.8): each hour the hurt bleed and heal (heal.ts), the dead lie
// unburied or are buried at day's end (death.ts). What hurts people is their work (people/
// accident.ts); who finds, carries, binds, dresses and buries them is the people's (people/
// care.ts, nurse.ts, burial.ts). `hurt` is a test-mode tool (V-041): a wound given by hand.
import { clockAt } from '../core/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { buryAtDayEnd, unburiedHour } from './death.ts';
import { healHour } from './heal.ts';
import { HEALTH_TABLES, partDef, wound } from './wounds.ts';

/** `hurt {person, part, severity}` (test mode): a cut there, as if it had happened. */
function hurt(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number): void {
  const { world, content } = ctx;
  const p = (world.entities['person'] ?? []).find((q) => q.id === data['person']);
  const sev = content.health.severities.find((s) => s.id === data['severity']);
  const part = partDef(content, data['part'] as string);
  const reason =
    !p || p['status'] !== 'alive'
      ? 'no such person alive'
      : !part
        ? 'no such part'
        : !sev
          ? 'no such severity'
          : '';
  if (reason) {
    ctx.emit('command.refused', { causes: [cause], data: { kind: 'hurt', reason } });
    return;
  }
  const mortal = !!sev!.mortal && ctx.rng().int(100) < sev!.mortal;
  wound(
    ctx,
    p!,
    {
      part: part!.id,
      kind: 'cut',
      severity: sev!.id,
      what: 'was hurt by a test-mode order',
      where: '',
      place: '',
    },
    [cause],
    mortal,
  );
}

export const healthSystem: System = {
  id: 'health',
  every: 'hour',
  stream: 'health',
  emits: [
    'hall.mourned',
    'health.hurt',
    'health.festered',
    'health.feverBroke',
    'health.healed',
    'health.died',
    'health.unburied',
    'health.buried',
  ],
  tables: HEALTH_TABLES,
  commands: { hurt: (ctx, command, cause) => hurt(ctx, command.data, cause) },
  run(ctx) {
    healHour(ctx);
    unburiedHour(ctx);
    buryAtDayEnd(ctx, clockAt(ctx.world.tick, ctx.content.calendar).hour);
  },
};
