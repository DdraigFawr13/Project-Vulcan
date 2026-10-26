// The herb garden from need (P5.7, V-136). Once the herb store ran dry while someone needed herbs
// (a draught or a dressing found none: the health tables' `herbless` ticks), the colony lays out
// a garden of `health.garden` w by h herb beds in the next sowing month: beside the sickroom, else
// the first house, on the nearest free, dry, open ground. The beds are a build part the builders
// lay (Build row); in each herb month every bed laid gives one herb, lying on it for the haulers.
// Laid out once; there is no Send back. The build system reads the health tables; it imports
// nothing of health.
import { clockAt, TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { dryAt, freeTile, itemsOf, layItem } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { liveFields, tilesOf } from './fields.ts';
import { dirFrom } from './houses.ts';
import { livePastures, onPastureGround } from './pasturerows.ts';
import { housesOf, inRect, rectOf, type Rect } from './site.ts';

export const HERB_TABLES: Schemas = {
  /** The garden: its rectangle, the line that laid it out, `fed` the month (year * months +
   * month + 1) it last gave herbs. */
  garden: { x: 'int', y: 'int', w: 'count', h: 'count', line: 'event', fed: 'int' },
};

export const gardensOf = (world: WorldState): EntityRow[] => world.entities['garden'] ?? [];

/** When the herb store last ran dry for someone who needed it (0 never), and that row's line. */
function lastHerbless(world: WorldState): { tick: number; line: number } {
  let best = { tick: 0, line: 0 };
  for (const table of ['ill', 'wound'])
    for (const r of world.entities[table] ?? []) {
      const t = r['herbless'] as number;
      if (t > best.tick) best = { tick: t, line: (r['line'] as number) || 0 };
    }
  return best;
}

/** The nearest free, dry, open block of the garden's size beside `by`. */
function siteGarden(ctx: SystemContext, by: Rect): Rect | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const { w, h } = content.health.garden;
  const fields = new Set(liveFields(world).flatMap((f) => tilesOf(f)));
  const pastures = livePastures(world);
  const houses = housesOf(world)
    .filter((x) => x['state'] !== 'sent')
    .map(rectOf);
  const [cx, cy] = [2 * by.x + by.w - 1, 2 * by.y + by.h - 1];
  const reach = 12;
  const blocks: { x: number; y: number; d: number }[] = [];
  for (let y = by.y - reach; y <= by.y + by.h + reach; y += 1)
    for (let x = by.x - reach; x <= by.x + by.w + reach; x += 1) {
      const [dx, dy] = [2 * x + w - 1 - cx, 2 * y + h - 1 - cy];
      blocks.push({ x, y, d: dx * dx + dy * dy });
    }
  blocks.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const open = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < map.width &&
    y < map.height &&
    freeTile(world, content, x, y) &&
    dryAt(content, map, y * map.width + x) &&
    !map.features[y * map.width + x] &&
    !fields.has(y * map.width + x) &&
    !pastures.some((p) => onPastureGround(p, map.width, x, y)) &&
    // A tile's width of open ground round every house, for its door and its walls.
    !houses.some((r) => inRect({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, x, y));
  for (const b of blocks) {
    let fits = true;
    for (let y = b.y; y < b.y + h && fits; y += 1)
      for (let x = b.x; x < b.x + w && fits; x += 1) fits = open(x, y);
    if (fits) return { x: b.x, y: b.y, w, h };
  }
  return undefined;
}

const monthNow = (ctx: SystemContext): { name: string; index: number } => {
  const c = clockAt(ctx.world.tick, ctx.content.calendar);
  const months = ctx.content.calendar.monthNames;
  return { name: months[c.month] ?? '', index: c.year * months.length + c.month + 1 };
};

/** Each hour: lays out the garden in a sowing month after the herb store ran dry for someone in
 * the last year; and in each herb month a garden whose beds are laid gives its herbs. */
export function planHerbGarden(ctx: SystemContext): void {
  const { world, content } = ctx;
  const def = content.health.garden;
  const month = monthNow(ctx);
  const garden = gardensOf(world)[0];
  if (garden) return feed(ctx, garden, month);
  if (!def.sow.includes(month.name)) return;
  const dry = lastHerbless(world);
  if (!dry.tick || world.tick - dry.tick > def.within * TICKS_PER_DAY) return;
  const sick = housesOf(world).find((x) => x['sick'] && x['state'] === 'built');
  const main = housesOf(world).find((x) => !x['of'] && x['state'] === 'built');
  const by = sick ?? main;
  if (!by) return;
  const r = siteGarden(ctx, rectOf(by));
  if (!r) return;
  const b = rectOf(by);
  const centre = { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2), z: 0 };
  const line = ctx.emit('build.herbGarden', {
    causes: [dry.line].filter((c) => c > 0),
    data: { beside: sick ? 'the sickroom' : 'the first house', dir: dirFrom(centre, r) },
  });
  addEntity(world, 'garden', { ...r, line, fed: 0 });
  for (let y = r.y; y < r.y + r.h; y += 1)
    for (let x = r.x; x < r.x + r.w; x += 1)
      addEntity(world, 'plan', {
        ...{ part: def.bed, x, y, z: 0, have: 0, also: 0, work: -1, state: 'plan', house: 0 },
        ...{ line, done: 0, waited: 0, shut: 0, held: 0 },
      });
}

/** In a herb month not yet fed: one herb on each laid bed with nothing lying on it. */
function feed(ctx: SystemContext, g: EntityRow, month: { name: string; index: number }): void {
  const { world, content } = ctx;
  if (g['fed'] === month.index || !content.work.forage.herbs.months.includes(month.name)) return;
  g['fed'] = month.index;
  const beds = (world.entities['plan'] ?? []).filter(
    (p) =>
      p['part'] === content.health.garden.bed &&
      p['state'] === 'built' &&
      inRect(rectOf(g), p['x'] as number, p['y'] as number),
  );
  for (const b of beds) {
    const [x, y] = [b['x'] as number, b['y'] as number];
    if (itemsOf(world).some((i) => i['x'] === x && i['y'] === y && i['z'] === 0 && !i['holder']))
      continue;
    layItem(world, {
      ...{ kind: content.health.herbs.item, count: 1, x, y, z: 0 },
      made: g['line'] as number,
    });
  }
}
