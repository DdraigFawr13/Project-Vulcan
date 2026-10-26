// What the beekeeper's work does to a skep (P5.13, V-135): each is a state change and its ledger
// line, citing the beekeeper's taking up and the skep's own latest line, so every line leads back to
// the siting. Who walks where, and for how many minutes, is people/beekeep.ts.
import type { EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dayNow, swarmComes, yearNow } from './skeps.ts';

const FIELD = 'field';

/** The skep is made: `plan` becomes `empty` (`bees.skep`). */
export function skepMade(ctx: SystemContext, skep: EntityRow, p: EntityRow): void {
  skep['line'] = ctx.emit('bees.skep', {
    causes: [p['took'] as number, skep['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, field: FIELD },
  });
  skep['state'] = 'empty';
}

/** A beekeeper looks over an empty skep, once a day: maybe a swarm is caught into it (`bees.swarm`,
 * `bees` stream). Returns whether it was. */
export function skepTended(ctx: SystemContext, skep: EntityRow, p: EntityRow): boolean {
  skep['visited'] = dayNow(ctx.world);
  if (!swarmComes(ctx.world, ctx.content)) return false;
  skep['line'] = ctx.emit('bees.swarm', {
    causes: [p['took'] as number, skep['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, field: FIELD },
  });
  skep['state'] = 'bees';
  return true;
}

/** The honey and wax are taken from a skep with bees (`bees.harvest`): marks the year and returns
 * what to lay and the line to lay it under. */
export function honeyTaken(
  ctx: SystemContext,
  skep: EntityRow,
  p: EntityRow,
): { honey: number; wax: number; line: number } {
  const { honey, wax } = ctx.content.lamp.bees.harvest;
  skep['harvested'] = yearNow(ctx.world, ctx.content);
  const line = ctx.emit('bees.harvest', {
    causes: [p['took'] as number, skep['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, field: FIELD, honey, wax },
  });
  skep['line'] = line;
  return { honey, wax, line };
}
