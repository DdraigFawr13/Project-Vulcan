// The catching-sick kept apart (P6.5, V-144). While the Sickness law in force has `sick`, each
// hour someone newly sick with a catching illness is weighed once: if they or anyone who shares
// their house refuses the law, they stay at home with a line naming who kept them. Otherwise,
// under `house`, the bout is marked `sent` (the law's line) and care.ts lays them in the
// sick-house once one stands (a bed elsewhere is left for it); under `away` they leave the valley
// by their home's road with a line and nobody nurses them. Someone away comes back once it has
// passed; who dies out there is not brought home (health/death.ts, body `away`).
import type { EntityRow, WorldState } from '../core/index.ts';
import { greenOf, houseAt, piecesOf } from '../build/index.ts';
import {
  bodiesOf,
  bodyOf,
  boutOf,
  catching,
  homeHouse,
  illDef,
  illsOf,
  pronouns,
  stopFor,
} from '../health/index.ts';
import { answerTo, sickRule } from '../law/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { edgeSpot } from './edge.ts';
import { list } from './verdict.ts';

const people = (world: WorldState): EntityRow[] => world.entities['person'] ?? [];

/** The road someone leaves and comes back by: their home's side, else the south. */
const roadOf = (p: EntityRow): string => (p['homeDir'] as string) || 'south';

/** Where the road out meets the map's edge, else (a valley shut in by rock) the green. */
const wayOut = (ctx: SystemContext, p: EntityRow): Spot =>
  edgeSpot(ctx.world, ctx.content, roadOf(p)) ?? greenOf(ctx.world);

/** Whether `p`, sick with a catching illness, should lie in the sick-house now. */
export function toSickHouse(ctx: SystemContext, p: EntityRow): boolean {
  const bout = catching(ctx.world, ctx.content, p.id);
  return !!bout?.['sent'] && sickRule(ctx.world, ctx.content)?.s.sick === 'house';
}

/** Whether `bed` is in the sick-house (P6.5), not the sickroom. */
export const inSickHouse = (world: WorldState, bed: EntityRow): boolean =>
  houseAt(world, bed['x'] as number, bed['y'] as number)?.['sick'] === 2;

/** Each hour: the newly catching-sick are kept at home, sent to the sick-house or away, and
 * whoever was away and is over it comes back. */
export function apartHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  for (const p of people(world)) {
    if (p['status'] === 'away') {
      if (!boutOf(world, p.id)) comeBack(ctx, p);
      continue;
    }
    if (p['status'] !== 'alive') continue;
    const bout = catching(world, content, p.id);
    const rule = sickRule(world, content);
    if (!bout || !rule) continue;
    if (!bout['sent'] && !bout['kept']) weigh(ctx, p, bout, rule);
    else if (bout['sent'] && rule.s.sick === 'house') moveOver(ctx, p);
  }
}

/** Kept at home by whoever refuses the law among them and their housemates, else sent. */
function weigh(
  ctx: SystemContext,
  p: EntityRow,
  bout: EntityRow,
  rule: NonNullable<ReturnType<typeof sickRule>>,
): void {
  const { world, content } = ctx;
  const home = homeHouse(world, content, p);
  const kin = people(world).filter(
    (q) =>
      q['status'] === 'alive' &&
      (q.id === p.id || (!!home && homeHouse(world, content, q) === home)),
  );
  const refusers = kin.filter((q) => answerTo(world, rule.law, q.id)?.['answer'] === 'refuses');
  const ill = illDef(content, bout['ill'] as string)?.name ?? 'a sickness';
  if (refusers.length) {
    // "Brann would not send her away", or of themself "Ada would not leave the valley".
    const self = refusers.length === 1 && refusers[0]!.id === p.id;
    const them = pronouns(p).them;
    const away = rule.s.sick === 'away';
    const where = self
      ? away
        ? 'leave the valley'
        : 'go to the sick-house'
      : away
        ? `send ${them} away`
        : `lay ${them} in the sick-house`;
    bout['kept'] = ctx.emit('people.keptHome', {
      causes: [
        bout['line'] as number,
        ...refusers.map((q) => answerTo(world, rule.law, q.id)!['line'] as number),
      ],
      actors: [p.id, ...refusers.filter((q) => q.id !== p.id).map((q) => q.id)],
      data: {
        name: p['name'] as string,
        ill,
        who: list(refusers.map((q) => q['name'] as string)),
        where,
      },
    });
    return;
  }
  if (rule.s.sick === 'house') {
    bout['sent'] = rule.line;
    return;
  }
  bout['sent'] = ctx.emit('people.sentAway', {
    causes: [bout['line'] as number, rule.line].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, ill, dir: roadOf(p), them: pronouns(p).them },
  });
  stopFor(ctx, p, false);
  const body = bodyOf(world, p.id);
  if (body)
    Object.assign(body, { down: 0, found: 0, bed: 0, roll: 0, carrier: 0, finder: 0, healer: 0 });
  Object.assign(p, { ...wayOut(ctx, p), status: 'away', doing: '', path: [], stride: 0 });
}

/** Sent to the sick-house but laid elsewhere: once a bed there is free, they are left for
 * someone to carry over (care.ts finds the bed). */
function moveOver(ctx: SystemContext, p: EntityRow): void {
  const { world } = ctx;
  const body = bodyOf(world, p.id);
  if (!body?.['bed'] || body['carrier']) return;
  const at = piecesOf(world, 'bed').find((b) => b.id === body['bed']);
  if (body['roll'] === 0 && at && inSickHouse(world, at)) return;
  const taken = new Set(bodiesOf(world).map((b) => b['bed']));
  const free = piecesOf(world, 'bed').some((b) => inSickHouse(world, b) && !taken.has(b.id));
  if (free) Object.assign(body, { bed: 0, roll: 0 });
}

/** Over it while away: back by the road they left by, with a line. */
function comeBack(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const bout = illsOf(world)
    .filter((r) => r['person'] === p.id && r['sent'])
    .at(-1);
  Object.assign(p, { ...wayOut(ctx, p), status: 'alive' });
  ctx.emit('people.cameBack', {
    causes: [(bout?.['sent'] as number) ?? 0].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      dir: roadOf(p),
      ill: illDef(content, (bout?.['ill'] as string) ?? '')?.name ?? 'the sickness',
    },
  });
}
