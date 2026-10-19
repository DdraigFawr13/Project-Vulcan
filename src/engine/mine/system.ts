// The mine system (P4.1, V-086, V-087): sites a shaft by a stain when a metal is wanted and no open
// vein can feed it, as a plan with a reason; the player's one lever is `sendBackShaft`, once a
// plan, before anyone has begun it. A sunk shaft that opens no way to a vein is spent and a new one
// is sited. Digging is the people's (src/engine/people/mine.ts).
import type { EntityRow } from '../core/index.ts';
import { addEntity, entityOf } from '../entity/index.ts';
import { haveOf, stockOf, wantOf } from '../goods/index.ts';
import { TICKS_PER_DAY } from '../core/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { fill, MINE_TABLES, metalsOf, oreShort, shaftFor, shaftsOf } from './shafts.ts';
import { openVein, siteShaft } from './site.ts';
import { nextDig } from './tunnel.ts';

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Plans a shaft for `metal` citing `causes`, or says once per plate change that no stain does.
 * Returns whether a plan was made. */
function planShaft(
  ctx: SystemContext,
  metal: string,
  sentBack: number,
  causes: readonly number[],
): boolean {
  const { world, content, state } = ctx;
  const plate = stockOf(world, `${metal}-ingot`);
  const line = (plate?.['line'] as number | undefined) ?? 0;
  const site = siteShaft(world, content, metal);
  const name = content.features.find((f) => f.id === metal)!;
  if (!site) {
    // Once per metal for each change of its plate (the plate's line is the mark).
    if (state[`no-${metal}`] !== line)
      ctx.emit('mine.noStain', { causes: line ? [line] : [], data: { metal } });
    state[`no-${metal}`] = line;
    return false;
  }
  const word = name.vein?.stainWord ?? '';
  const ingot = `${metal}-ingot`;
  const why = fill(content.work.mine.why, {
    ...{ Metal: capital(metal), metal, have: haveOf(world, content, ingot) },
    ...{ want: wantOf(world, content, ingot), word, far: site.far, dir: site.dir },
  });
  const planned = ctx.emit('mine.shaftPlanned', {
    causes: [...causes, ...(line ? [line] : [])],
    data: { metal, level: name.vein?.level ?? 0, tiles: site.far, dir: site.dir, why },
  });
  addEntity(world, 'shaft', {
    ...{ x: site.x, y: site.y, metal, to: name.vein?.level ?? 0, state: 'planned' },
    ...{ depth: 0, sentBack, line: planned },
  });
  return true;
}

/** Whether a person has taken up sinking the shaft (they may not have sunk a level yet). */
const sinking = (ctx: SystemContext, shaft: EntityRow): boolean =>
  (ctx.world.entities['person'] ?? []).some(
    (q) => q['job'] === 'mine' && q['task'] === 'sink' && q['plan'] === shaft.id,
  );

/** `sendBackShaft {shaft}`: a shaft plan not yet begun (nobody has taken up sinking it), once; the
 * colony looks for another stain at least `work.mine.avoid` tiles off. */
function sendBackShaft(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
): void {
  const row = entityOf(ctx.world, 'shaft', data['shaft'] as number);
  const why = !row
    ? 'there is no such shaft'
    : row['state'] === 'sent'
      ? 'it was sent back already'
      : row['state'] !== 'planned' || row['depth'] || sinking(ctx, row)
        ? 'digging has begun'
        : row['sentBack']
          ? 'a plan that replaced one sent back cannot be sent back again'
          : undefined;
  if (why || !row) {
    ctx.emit('command.refused', {
      causes: [cause],
      data: { kind: 'sendBackShaft', reason: why ?? 'there is no such shaft' },
    });
    return;
  }
  row['state'] = 'sent';
  const back = ctx.emit('mine.shaftSentBack', {
    causes: [cause, row['line'] as number],
    data: { metal: row['metal'] as string },
  });
  planShaft(ctx, row['metal'] as string, 1, [back]);
}

export const mineSystem: System = {
  id: 'mine',
  every: 'hour',
  emits: ['mine.shaftPlanned', 'mine.shaftSentBack', 'mine.noStain', 'mine.noVein'],
  // `sig`: a mark of the ingot plates' lines and `day` the day of the last look, so the colony
  // looks again once a day or when a plate changes.
  initialState: { sig: 0, day: -1 },
  tables: MINE_TABLES,
  commands: { sendBackShaft: (ctx, command, cause) => sendBackShaft(ctx, command.data, cause) },
  run(ctx) {
    const { world, content, state } = ctx;
    const metals = metalsOf(content);
    const sig = metals.reduce(
      (n, m) => (n * 31 + ((stockOf(world, `${m}-ingot`)?.['line'] as number) ?? 0)) % 1000000007,
      7,
    );
    const day = Math.floor(world.tick / TICKS_PER_DAY);
    if (sig === state['sig'] && day === state['day']) return;
    [state['sig'], state['day']] = [sig, day];
    for (const metal of metals) {
      if (!oreShort(world, content, metal) || openVein(world, content, metal)) continue;
      const causes: number[] = [];
      const live = shaftFor(world, metal);
      if (live) {
        // A sunk shaft with no way on to a vein is spent: said once for each change of the plate.
        if (live['state'] !== 'done') continue;
        const foot = { x: live['x'] as number, y: live['y'] as number, z: live['to'] as number };
        if (nextDig(world, content, foot, metal, new Set())) continue;
        const line = (stockOf(world, `${metal}-ingot`)?.['line'] as number | undefined) ?? 0;
        live['state'] = 'spent';
        if (state[`novein-${metal}`] !== line)
          causes.push(ctx.emit('mine.noVein', { causes: line ? [line] : [], data: { metal } }));
        state[`novein-${metal}`] = line;
      }
      // A plan that replaces one sent back (still unplaced for want of a stain) cannot be sent back.
      const last = shaftsOf(world)
        .filter((s) => s['metal'] === metal)
        .at(-1);
      planShaft(ctx, metal, last?.['state'] === 'sent' ? 1 : 0, causes);
    }
  },
};
