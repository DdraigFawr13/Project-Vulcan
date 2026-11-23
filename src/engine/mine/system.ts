// The mine system (P4.1, V-086, V-215): sites a shaft beside a found seam when a metal is wanted
// and no open vein can feed it, as a plan with a reason; the player's one lever is `sendBackShaft`, once a
// plan, before anyone has begun it. A sunk shaft that opens no way to a vein is spent and a new one
// is sited. Digging is the people's (src/engine/land/mine.ts).
import type { EntityRow } from '../core/index.ts';
import { addEntity, entityOf } from '../entity/index.ts';
import { haveOf, ingotWant, stockOf, wornTools } from '../goods/index.ts';
import { TICKS_PER_DAY } from '../core/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { fill, MINE_TABLES, metalsOf, oreShort, shaftFor, shaftsOf } from './shafts.ts';
import { saltCause, saltOf, saltShort, saltWhy } from './salt.ts';
import { openVein, siteShaft } from './site.ts';
import { nextDig } from './tunnel.ts';
import { plantSeam } from './plant.ts';

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Plans a shaft for `metal` (or the salt seam, whose reason is the curer's) beside a found seam,
 * citing `causes`, the want and the seam's line; with no seam found, nothing (prospecting is
 * Scouting's, land `prospect.ts`). Returns whether a plan was made. */
function planShaft(
  ctx: SystemContext,
  metal: string,
  sentBack: number,
  causes: readonly number[],
): boolean {
  const { world, content } = ctx;
  const salt = metal === saltOf(content);
  const plate = stockOf(world, `${metal}-ingot`);
  const line = salt ? saltCause(world) : ((plate?.['line'] as number | undefined) ?? 0);
  const site = siteShaft(world, content, metal);
  const name = content.features.find((f) => f.id === metal)!;
  if (!site) return false;
  const word = name.vein?.seam ?? '';
  const ingot = `${metal}-ingot`;
  const have = haveOf(world, content, ingot);
  const why = salt
    ? saltWhy(world, content, word, site)
    : fill(content.work.mine.why, {
        ...{ Metal: capital(metal), metal, have },
        ...{ want: have + ingotWant(world, content, metal), word, far: site.far, dir: site.dir },
      });
  // The plate's line and the worn tools' lines that ask for metal (P4.9).
  const worn = salt ? [] : wornTools(world, content).map((w) => w.item['worn'] as number);
  const planned = ctx.emit('mine.shaftPlanned', {
    causes: [...causes, ...(line ? [line] : []), ...worn.filter((l) => l > 0), site.seam.line],
    data: {
      ...{ metal, level: name.vein?.level ?? 0, tiles: site.far, dir: site.dir, why },
      ...{ seam: word, x: site.x, y: site.y },
    },
  });
  addEntity(world, 'shaft', {
    ...{ x: site.x, y: site.y, metal, to: name.vein?.level ?? 0, state: 'planned' },
    ...{ depth: 0, sentBack, line: planned, why },
  });
  return true;
}

/** Whether a person has taken up sinking the shaft (they may not have sunk a level yet). */
const sinking = (ctx: SystemContext, shaft: EntityRow): boolean =>
  (ctx.world.entities['person'] ?? []).some(
    (q) => q['job'] === 'mine' && q['task'] === 'sink' && q['plan'] === shaft.id,
  );

/** `sendBackShaft {shaft}`: a shaft plan not yet begun (nobody has taken up sinking it), once; the
 * colony plans beside another found seam at least `work.mine.avoid` tiles off, or waits for one. */
function sendBackShaft(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
): void {
  const row = entityOf(ctx.world, 'shaft', data['shaft'] as number);
  const why = !row
    ? 'there is no such shaft'
    : !ctx.content.features.some((f) => f.id === row['metal'])
      ? 'it is the stair of a cellar, not a mine'
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
  emits: ['mine.shaftPlanned', 'mine.shaftSentBack', 'mine.noVein'],
  // `sig`: a mark of the ingot plates' lines and the seams found, and `day` the day of the last
  // look, so the colony looks again once a day, when a plate changes or a seam is found.
  initialState: { sig: 0, day: -1 },
  tables: MINE_TABLES,
  commands: {
    sendBackShaft: (ctx, command, cause) => sendBackShaft(ctx, command.data, cause),
    // Test mode only (V-041): the nearest seam of a metal found, as if someone had spotted it.
    findSeam: (ctx, command, cause) =>
      void plantSeam(ctx.world, ctx.content, String(command.data['metal']), cause),
  },
  run(ctx) {
    const { world, content, state } = ctx;
    const metals = metalsOf(content);
    const sig = metals.reduce(
      (n, m) => (n * 31 + ((stockOf(world, `${m}-ingot`)?.['line'] as number) ?? 0)) % 1000000007,
      // A seam found is looked at at once (V-215).
      7 + world.map.places.filter((p) => p.what && p.line).length,
    );
    const day = Math.floor(world.tick / TICKS_PER_DAY);
    if (sig === state['sig'] && day === state['day']) return;
    [state['sig'], state['day']] = [sig, day];
    // The salt seam is wanted like a metal, by the curer's need (salt.ts).
    const wanted = saltShort(world, content) ? [...metals, saltOf(content)] : metals;
    for (const metal of wanted) {
      const short = metal === saltOf(content) ? saltShort(world, content) : 0;
      if (!(short || oreShort(world, content, metal)) || openVein(world, content, metal)) continue;
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
      // A plan that replaces one sent back (still unplaced for want of a seam) cannot be sent back.
      const last = shaftsOf(world)
        .filter((s) => s['metal'] === metal)
        .at(-1);
      planShaft(ctx, metal, last?.['state'] === 'sent' ? 1 : 0, causes);
    }
  },
};
