// An ore wanted and not found (6W review, V-225): while a metal (or the cure's salt) is wanted
// and no seam of it is known, the colony keeps the day the want began, and once a season says so
// in one line ("Another season and still no copper; the tools are stone."), citing the want and
// the last trip that went for it. The Work sheet's Scouting row reads the day (worker `trips.ts`).
// Nothing comes from outside: the line only says how long.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { itemsOf, stockOf, toolOf } from '../goods/index.ts';
import { saltCause } from '../mine/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { oresWanted, oreWord } from './seams.ts';

/** Days in a season. */
export const seasonDays = (ctx: SystemContext): number => {
  const c = ctx.content.calendar;
  return (c.daysPerMonth * c.monthsPerYear) / c.seasons.length;
};

/** The tick each ore's want began, by its id, while it lasts. */
export const wantsSince = (ctx: SystemContext): Record<string, number> =>
  (ctx.world.systems['orewant'] ??= {});

/** "the tools are stone": the best material among the tools anyone holds. */
function toolsWord(ctx: SystemContext): string {
  const { content } = ctx;
  const order = content.tools.materials.map((m) => m.id);
  const held = itemsOf(ctx.world).filter((i: EntityRow) => i['state'] === 'held');
  const best = Math.max(-1, ...held.map((i) => order.indexOf(toolOf(content, i)?.material ?? '')));
  return best < 0 ? 'nobody has a tool' : `the tools are ${content.tools.materials[best]!.name}`;
}

/** At each day's start: wants that began are kept, wants met are dropped, and a want a season or
 * more old since its last line says so. */
export function oreWantDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % TICKS_PER_DAY !== 0) return;
  const since = wantsSince(ctx);
  const wanted = oresWanted(ctx);
  const salt = content.work.cure.salt.item;
  for (const key of Object.keys(since))
    if (!key.startsWith('l-') && !wanted.some((o) => o.metal === key)) {
      delete since[key];
      delete since[`l-${key}`];
    }
  const season = seasonDays(ctx) * TICKS_PER_DAY;
  for (const ore of wanted) {
    since[ore.metal] ??= world.tick;
    const last = since[`l-${ore.metal}`] ?? since[ore.metal]!;
    if (world.tick - last < season) continue;
    since[`l-${ore.metal}`] = world.tick;
    const isSalt = ore.metal === salt;
    const plate = isSalt ? saltCause(world) : stockOf(world, `${ore.metal}-ingot`)?.['line'];
    const trip = [...world.map.finds].reverse().find((f) => f.ore === 1 && f.good === ore.metal);
    const causes = [plate, trip?.line].filter((l): l is number => typeof l === 'number' && l > 0);
    ctx.emit('land.stillNoOre', {
      causes,
      data: {
        ore: oreWord(ctx, ore.f),
        metal: ore.metal,
        seasons: Math.floor((world.tick - since[ore.metal]!) / season),
        why: isSalt ? 'the meat goes uncured' : toolsWord(ctx),
      },
    });
  }
}
