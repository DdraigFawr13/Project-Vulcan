// The life of a field (P4.7, V-089): what the hour does to it. A sown field is lost to a frost
// under its crop's `frost` before it is ripe (`field.frostKilled`, citing the weather spell), else
// ripens `days` days after sowing (`field.ripe`); a field with no seed to sow says so once a
// season; a part-sown field is closed when seed or the sowing months run out; a field marked to
// leave when the town ring widened is left to grass once it holds no crop (after its next
// harvest, never before). The people's sowing and reaping end in `finishSowing` and
// `finishReaping`, which write the lines.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { haveOf, isTree, marksOf, stockOf } from '../goods/index.ts';
import { addMemories } from '../needs/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { feastInHall } from './homes.ts';
import {
  cropNow,
  cropOf,
  doneOf,
  dropField,
  fieldsOf,
  frosty,
  placeOf,
  seasonKey,
  tilesOf,
} from './fields.ts';
import { layOutGranary } from './granary.ts';
import { ringOf } from './ring.ts';
import { clearBlight, tickBlight } from './blight.ts';
import { drawSoil, tickSoil } from './soillife.ts';

const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** The field is left to grass: its tiles stop being a field. */
function leaveField(ctx: SystemContext, f: EntityRow, cause: number): void {
  const at = placeOf(ctx.world, f);
  ctx.emit('field.leftToGrass', { causes: [f['leave'] as number, cause], data: at });
  dropField(ctx.world, f);
}

/** A crop sown on every tile (or on all that could be): one line, and the clock starts. */
export function finishSowing(ctx: SystemContext, f: EntityRow, cause: number): void {
  const crop = cropOf(ctx.content, f['crop'] as string)!;
  // The field is the tiles sown, in their old order.
  const sown = new Set(doneOf(f));
  f['tiles'] = tilesOf(f).filter((i) => sown.has(i));
  f['done'] = [];
  f['state'] = 'sown';
  f['sown'] = ctx.world.tick;
  Object.assign(f, clearBlight(), { dry: tilesOf(f).map(() => 0) });
  f['last'] = ctx.emit('field.sown', {
    causes: [cause, f['last'] as number],
    data: { crop: crop.name, tiles: tilesOf(f).length, ...placeOf(ctx.world, f) },
  });
}

/** The last tile is reaped: the harvest is in (`field.harvested`), the people who reaped it
 * brought it home (`farm.harvestHome`), and the field lies fallow, or goes if it was marked to
 * leave. `cause` is the last reaper's taking up of the work. */
export function finishReaping(ctx: SystemContext, f: EntityRow, cause: number): void {
  const { world, content } = ctx;
  const crop = cropOf(content, f['crop'] as string)!;
  const what = content.items.find((i) => i.id === crop.item)?.name ?? crop.item;
  const count = (f['got'] as number) + (f['kept'] as number);
  const harvested = ctx.emit('field.harvested', {
    causes: [cause, f['last'] as number],
    data: { crop: crop.name, count, what, kept: f['kept'] as number, ...placeOf(world, f) },
  });
  const reapers = (f['reapers'] as number[])
    .map((id) => (world.entities['person'] ?? []).find((p) => p.id === id))
    .filter((p): p is EntityRow => !!p);
  const home = ctx.emit('farm.harvestHome', {
    causes: [harvested],
    actors: reapers.map((p) => p.id),
    data: { names: list(reapers.map((p) => p['name'] as string)), crop: crop.name, count, what },
  });
  addMemories(
    ctx,
    reapers.map((p) => p.id),
    'harvested',
    home,
  );
  // The harvest-home supper is eaten in the hall (P5.14).
  feastInHall(ctx, home);
  layOutGranary(ctx, f, harvested);
  drawSoil(ctx, f, crop.id, harvested);
  Object.assign(f, { state: 'fallow', crop: '', done: [], reapers: [], got: 0, kept: 0 });
  Object.assign(f, clearBlight());
  f['last'] = harvested;
  if (f['leave']) leaveField(ctx, f, harvested);
}

/** Marks the fields the widened ring now covers to leave: at once if nothing grows on them, else
 * after their next harvest. */
export function markLeaving(ctx: SystemContext, green: Spot, cause: number): void {
  const { world, content } = ctx;
  const ring = ringOf(world, content);
  const width = world.map.width;
  for (const f of [...fieldsOf(world)]) {
    if (f['state'] === 'sent' || f['leave']) continue;
    const far = (i: number) =>
      Math.max(Math.abs((i % width) - green.x), Math.abs(Math.floor(i / width) - green.y));
    if (!tilesOf(f).some((i) => far(i) <= ring)) continue;
    f['leave'] = cause;
    if (f['state'] === 'fallow' || (f['state'] === 'plan' && !doneOf(f).length))
      leaveField(ctx, f, cause);
  }
}

/** Trees on a field are marked to fell only when sowing needs the ground: when the seed in hand
 * outruns the unsown tiles that are clear, as many trees as it takes (in tile order). */
function clearFor(ctx: SystemContext, f: EntityRow, seed: number): void {
  const { world, content } = ctx;
  const width = world.map.width;
  const unsown = tilesOf(f).filter((i) => !doneOf(f).includes(i));
  const clear = unsown.filter((i) => !isTree(world, content, i)).length;
  const marked = new Set(
    marksOf(world)
      .filter((m) => m['house'] === f.id)
      .map((m) => (m['y'] as number) * width + (m['x'] as number)),
  );
  const need = Math.min(seed, unsown.length) - clear - marked.size;
  if (need <= 0) return;
  for (const i of unsown.filter((t) => isTree(world, content, t) && !marked.has(t)).slice(0, need))
    addEntity(world, 'mark', {
      ...{ x: i % width, y: Math.floor(i / width), line: f['line'] as number, house: f.id },
    });
}

/** Each hour: frost, ripening, no-seed alerts and closing part-sown fields. */
export function tickFields(ctx: SystemContext): void {
  const { world, content } = ctx;
  const weather = world.systems['weather'];
  tickSoil(ctx, fieldsOf(world));
  tickBlight(ctx, fieldsOf(world));
  for (const f of [...fieldsOf(world)]) {
    const state = f['state'] as string;
    if (state === 'sown') {
      const crop = cropOf(content, f['crop'] as string)!;
      if (frosty(world, content, f, crop.frost)) {
        f['last'] = ctx.emit('field.frostKilled', {
          causes: [weather?.['spell'] ?? 0, f['last'] as number].filter((l) => l > 0),
          data: { crop: crop.name, tiles: tilesOf(f).length, ...placeOf(world, f) },
        });
        Object.assign(f, { state: 'fallow', crop: '', done: [] }, clearBlight());
        if (f['leave']) leaveField(ctx, f, f['last'] as number);
      } else if (world.tick >= (f['sown'] as number) + crop.days * TICKS_PER_DAY) {
        f['state'] = 'ripe';
        f['last'] = ctx.emit('field.ripe', {
          causes: [f['last'] as number],
          data: { crop: crop.name, ...placeOf(world, f) },
        });
      }
    } else if (state === 'plan' || state === 'fallow') {
      const crop = cropNow(world, content, f);
      const seed = haveOf(world, content, content.buildings.field.seed);
      // A part-sown field (first or later sowing) closes when the seed (none carried either) or the sowing months run out.
      if (doneOf(f).length > 0 && (!crop || !seed)) {
        finishSowing(ctx, f, (f['took'] as number) || (f['last'] as number));
      } else if (crop && seed) {
        clearFor(ctx, f, seed);
      } else if (crop && f['noSeed'] !== seasonKey(world, content)) {
        f['noSeed'] = seasonKey(world, content);
        const plate = stockOf(world, content.buildings.field.seed)?.['line'] as number | undefined;
        ctx.emit('field.noSeed', {
          causes: [f['last'] as number, ...(plate ? [plate] : [])],
          data: placeOf(world, f),
        });
      }
    }
  }
}
