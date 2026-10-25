// What happens to field soil (Phase 5B Bundle 2, V-130): a harvest takes its crop's `draw` from
// each tile (beans give back), the first day of the winter month lays every field's tiles a little
// better, a resting field says so, and on the first day of the muck month the fold and the midden
// give loads of muck that farmers carry to the poorest fallow ground (people/farm.ts). All dials
// are content `buildings.field.soil`; the pure reads are fieldsoil.ts.
import { clockAt, TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { cropNow, doneOf, liveFields, placeOf, tilesOf } from './fields.ts';
import { courseNow, meanSoil } from './fieldsoil.ts';
import { middensOf } from './midden.ts';
import { livePastures } from './pasturerows.ts';

/** Changes every tile of the field by `by` (kept 0 to 100) and says so: `what` fills the line. */
function shiftSoil(ctx: SystemContext, f: EntityRow, by: number, what: string, cause: number) {
  const { world } = ctx;
  const from = meanSoil(world, f);
  for (const i of tilesOf(f))
    world.map.fertility[i] = Math.max(0, Math.min(100, world.map.fertility[i]! + by));
  const to = meanSoil(world, f);
  f['last'] = ctx.emit('field.soil', {
    causes: [cause, f['last'] as number].filter((l) => l > 0),
    data: { what, from, to, ...placeOf(world, f) },
  });
}

/** The harvest is in: the soil pays for the crop (or, for beans, is paid back), and the field
 * remembers the crop (its last two) for blight. */
export function drawSoil(ctx: SystemContext, f: EntityRow, cropId: string, cause: number): void {
  const crop = ctx.content.buildings.field.crops.find((c) => c.id === cropId)!;
  shiftSoil(ctx, f, -crop.draw, `${crop.draw < 0 ? 'rose' : 'fell'} after the ${crop.name}`, cause);
  f['prev'] = [...((f['prev'] as string) || '').split(',').filter(Boolean), cropId]
    .slice(-2)
    .join(',');
}

/** Loads of muck the colony has to carry (build system state `muck`). */
export const muckLeft = (world: WorldState): number => world.systems['build']?.['muck'] ?? 0;

/** Whether muck may go on this field: nothing in it, nothing sown, and a tile below 100. */
export const mucky = (world: WorldState, f: EntityRow): boolean =>
  !f['crop'] &&
  !doneOf(f).length &&
  (f['state'] === 'fallow' || f['state'] === 'plan') &&
  tilesOf(f).some((i) => world.map.fertility[i]! < 100);

/** The field tile with the poorest soil (lowest index first among equals). */
export const poorestTile = (world: WorldState, f: EntityRow): number =>
  tilesOf(f).reduce((a, b) => (world.map.fertility[b]! < world.map.fertility[a]! ? b : a));

/** A farmer takes up a load at the fold or the midden; false when none is left. */
export function takeLoad(world: WorldState): boolean {
  const state = world.systems['build'];
  if (!state || !state['muck']) return false;
  state['muck'] -= 1;
  return true;
}

/** A load of muck goes on a tile: `muck.gain` fertility (to 100). No line a load. */
export function spreadMuck(ctx: SystemContext, tile: number): void {
  const { world, content } = ctx;
  world.map.fertility[tile] = Math.min(
    100,
    world.map.fertility[tile]! + content.buildings.field.soil.muck.gain,
  );
}

/** A field with soil under `soil.rest` that would be sown this window rests it: one line a month. */
function restLine(ctx: SystemContext, f: EntityRow): void {
  const { world, content } = ctx;
  const c = clockAt(world.tick, content.calendar);
  const key = c.year * content.calendar.monthsPerYear + c.month + 1;
  const month = content.calendar.monthNames[c.month] ?? '';
  if (f['rested'] === key || !courseNow(content, f, month)) return;
  if (cropNow(world, content, f)) return;
  f['rested'] = key;
  f['last'] = ctx.emit('field.rests', {
    causes: [f['last'] as number],
    data: { soil: meanSoil(world, f), ...placeOf(world, f) },
  });
}

/** Once a day, from the hourly field tick: fallow gain, the year's muck, and rests. */
export function tickSoil(ctx: SystemContext, fields: EntityRow[]): void {
  const { world, content, state } = ctx;
  const idle = fields.filter(
    (f) => !f['crop'] && (f['state'] === 'plan' || f['state'] === 'fallow'),
  );
  const day = Math.floor(world.tick / TICKS_PER_DAY) + 1;
  if (state['soilDay'] === day) return;
  state['soilDay'] = day;
  const c = clockAt(world.tick, content.calendar);
  const month = content.calendar.monthNames[c.month];
  const { winter, muck } = content.buildings.field.soil;
  if (c.day === 1 && month === winter.month)
    for (const f of liveFields(world))
      shiftSoil(ctx, f, winter.gain, 'lay fallow over the winter', f['last'] as number);
  if (c.day === 1 && month === muck.month) {
    const herds = (world.entities['herd'] ?? []).filter((h) =>
      livePastures(world).some((p) => p.id === h['kept']),
    );
    const kept = new Set(herds.map((h) => h.id));
    const animals = (world.entities['animal'] ?? []).filter((a) => kept.has(a['herd'] as number));
    const middens = middensOf(world);
    state['muck'] = middens.length * muck.midden + animals.length * muck.fold;
    if (state['muck'])
      ctx.emit('field.muckReady', {
        causes: [
          ...middens.map((m) => m.line),
          ...livePastures(world).map((p) => p['line'] as number),
        ],
        data: { loads: state['muck'] },
      });
  }
  for (const f of idle) restLine(ctx, f);
}
