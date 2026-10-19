// The mine system (P4.1, V-086, V-087): sites a shaft by a stain when a metal is wanted and no open
// vein can feed it, as a plan with a reason; the player's one lever is `sendBackShaft`, once a
// plan. Digging is the people's (src/engine/people/mine.ts).
import { addEntity, entityOf } from '../entity/index.ts';
import { haveOf, stockOf, wantOf } from '../goods/index.ts';
import { TICKS_PER_DAY } from '../core/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { MINE_TABLES, metalsOf, oreShort, shaftFor, shaftsOf } from './shafts.ts';
import { openVein, siteShaft } from './site.ts';

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
  const why =
    `${capital(metal)} is wanted (${haveOf(world, content, ingot)} of ${wantOf(world, content, ingot)} ingots) ` +
    `and no open vein holds ${metal}. This is by the nearest ${word} stain past the town ring: ` +
    `${site.far} tiles ${site.dir} of the green, on dry, level ground.`;
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

/** `sendBackShaft {shaft}`: a shaft plan not yet started, once; the colony looks for another stain
 * at least `AVOID` tiles off. */
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
      : row['state'] !== 'planned' || row['depth']
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
  emits: ['mine.shaftPlanned', 'mine.shaftSentBack', 'mine.noStain'],
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
      if (!oreShort(world, content, metal) || shaftFor(world, metal)) continue;
      if (openVein(world, content, metal)) continue;
      planShaft(ctx, metal, shaftsOf(world).some((s) => s['metal'] === metal) ? 1 : 0, []);
    }
  },
};
