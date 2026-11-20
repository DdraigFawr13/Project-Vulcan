// The dark side of ale (6B Bundle 5, P6.12, V-188). A `brawl.trait` (hot-tempered) drinker who has
// just had a second cup throws the inn's dice once that evening: at `brawl.chance` per cent they
// come to blows with the nearest other drinker there, both lightly wounded and remembering it, a
// `tavern.brawled` line (a tale of its own). Someone who drank more than `hungOver.after` cups wakes
// hung over: the `hungOver.memory`, and until `hungOver.until` o'clock a minute in `idle` lost at
// work (people mind.ts asks `hungOver`).
import { clockAt, TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { far } from '../entity/index.ts';
import { wound } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { drinkersIn } from './evening.ts';
import { nightOf, tavernName, today } from './tables.ts';

const hot = (ctx: SystemContext, p: EntityRow): boolean =>
  (ctx.world.entities['trait'] ?? []).some(
    (t) => t['person'] === p.id && t['trait'] === ctx.content.tavern.brawl.trait,
  );

/** After this hour's cups: a hot-tempered drinker on their second may start a fight. */
export function brawls(ctx: SystemContext, drank: readonly EntityRow[]): void {
  const { world, content } = ctx;
  const b = content.tavern.brawl;
  for (const p of drank) {
    const row = nightOf(world, p.id)!;
    if ((row['cups'] as number) < 2 || row['brawled'] || !hot(ctx, p)) continue;
    row['brawled'] = 1;
    if (ctx.rng().int(100) >= b.chance) continue;
    const other = drinkersIn(ctx)
      .filter((q) => q.id !== p.id)
      .sort((x, y) => far(p, x) - far(p, y) || x.id - y.id)[0];
    if (!other) continue;
    const tavern = tavernName(world);
    const line = ctx.emit('tavern.brawled', {
      causes: [row['line'] as number].filter((l) => l > 0),
      actors: [p.id, other.id],
      data: { name: p['name'] as string, other: other['name'] as string, tavern },
    });
    for (const [x, y] of [
      [p, other],
      [other, p],
    ] as const) {
      const rng = ctx.rng();
      const kind = rng.pick(b.kinds);
      const part = rng.pick(b.parts);
      const what = b.what.replace('{other}', y['name'] as string);
      wound(
        ctx,
        x,
        { part, kind, severity: 'light', what, where: tavern, place: 'at' },
        [line],
        false,
      );
      addMemory(ctx, x.id, b.memory, line, y.id);
    }
  }
}

/** Each hour: whoever drank too much last night and is up wakes hung over. */
export function hangovers(ctx: SystemContext): void {
  const { world, content } = ctx;
  const h = content.tavern.hungOver;
  const day = today(world);
  for (const row of world.entities['night'] ?? []) {
    if (row['day'] !== day - 1 || (row['cups'] as number) <= h.after || row['hung']) continue;
    const p = (world.entities['person'] ?? []).find((q) => q.id === row['person']);
    if (!p || p['status'] !== 'alive' || p['doing'] === 'sleep') continue;
    row['hung'] = day * TICKS_PER_DAY + h.until * 60;
    addMemory(ctx, p.id, h.memory, row['line'] as number);
  }
}

/** Whether `p` loses this minute at work to a hangover. */
export function hungOver(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const row = nightOf(world, p.id);
  if (!row || world.tick >= (row['hung'] as number)) return false;
  if (clockAt(world.tick, content.calendar).hour >= content.tavern.hungOver.until) return false;
  return (world.tick + p.id) % content.tavern.hungOver.idle === 0;
}
