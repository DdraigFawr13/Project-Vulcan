// Blight and dry spells (Phase 5B Bundle 2, V-130). A daily count of wet days (a 14-bit mask in
// build state `wetBits`) lets blight start on a sown field after a wet spell, from the `blight`
// RNG stream, and spread on wet days; a blighted tile yields nothing, and a crop grown enough is
// cut early. In a dry spell the tiles of a sown field far from water lose a little yield a day
// unless a farmer watered them (people/water-fields.ts). The dials are content
// `buildings.field.blight` and `dry`; `tileYield` is the one place a tile's yield is worked out.
import {
  streamFor,
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { cropOf, placeOf, tilesOf } from './fields.ts';
import { yieldAt } from './fieldsoil.ts';

const ints = (f: EntityRow, key: string): number[] => f[key] as number[];

/** Wet days among the last `blight.span` days. */
export function wetDays(world: WorldState): number {
  let bits = world.systems['build']?.['wetBits'] ?? 0;
  let n = 0;
  for (; bits; bits >>= 1) n += bits & 1;
  return n;
}

/** Whether today's weather is the dry kind that costs yield. */
export const dryToday = (world: WorldState, content: EngineContent): boolean =>
  content.weather[world.systems['weather']?.['kind'] ?? 0]?.id ===
  content.buildings.field.dry.weather;

/** Whether surface tile `tile` is more than `dry.near` tiles from drinkable water (frozen or not). */
export function farFromWater(world: WorldState, content: EngineContent, tile: number): boolean {
  const { width, height, tiles } = world.map;
  const near = content.buildings.field.dry.near;
  const [x, y] = [tile % width, Math.floor(tile / width)];
  for (let dy = -near; dy <= near; dy += 1)
    for (let dx = -near + Math.abs(dy); dx <= near - Math.abs(dy); dx += 1) {
      const [a, b] = [x + dx, y + dy];
      if (a >= 0 && b >= 0 && a < width && b < height)
        if (content.terrain.kinds[tiles[b * width + a]!]!.drinkable) return false;
    }
  return true;
}

/** The tiles of a sown field parched today: dry weather, far from water, not watered yet. */
export function thirsty(world: WorldState, content: EngineContent, f: EntityRow): number[] {
  if (f['state'] !== 'sown' || !dryToday(world, content)) return [];
  const watered = ints(f, 'watered');
  return tilesOf(f).filter((i) => !watered.includes(i) && farFromWater(world, content, i));
}

/** What one reaped tile yields: the soil's yield (fieldsoil.ts), less a dry spell's loss (`loss`
 * per cent a dry day, to `cap`), nothing if blighted, and the grown share if cut early. */
export function tileYield(
  world: WorldState,
  content: EngineContent,
  f: EntityRow,
  cropYield: number,
  tile: number,
): number {
  if (ints(f, 'blight').includes(tile)) return 0;
  const { loss, cap } = content.buildings.field.dry;
  const lost = Math.min(cap, loss * (ints(f, 'dry')[tilesOf(f).indexOf(tile)] ?? 0));
  const got = Math.round((yieldAt(world, content, cropYield, tile) * (100 - lost)) / 100);
  return f['cut'] ? Math.round((got * (f['cut'] as number)) / 100) : got;
}

/** The field is clear of blight, dry days and early cutting (sown anew, reaped, or lost). */
export const clearBlight = (): Record<string, unknown> => ({
  ...{ blight: [], dry: [], watered: [], cut: 0 },
});

/** Blight starts on one tile of the field; a crop grown enough goes ripe at once. */
function startBlight(ctx: SystemContext, f: EntityRow, wet: number, again: boolean): void {
  const { world, content } = ctx;
  const { early, span } = content.buildings.field.blight;
  const crop = cropOf(content, f['crop'] as string)!;
  ints(f, 'blight').push(streamFor(world, 'blight').pick(tilesOf(f)));
  const grown = Math.min(
    100,
    Math.floor((100 * (world.tick - (f['sown'] as number))) / (crop.days * TICKS_PER_DAY)),
  );
  const cutNow = grown >= early;
  const spell = world.systems['weather']?.['spell'] ?? 0;
  f['last'] = ctx.emit('field.blight', {
    causes: [spell, f['last'] as number].filter((l) => l > 0),
    data: {
      crop: crop.name,
      wet,
      span,
      again: again ? `, and ${crop.name} grew there last year` : '',
      early: cutNow ? ` It was ${grown} per cent grown and is cut early.` : '',
      ...placeOf(world, f),
    },
  });
  if (cutNow) Object.assign(f, { state: 'ripe', cut: grown });
}

/** Blight spreads to each 4-neighbour field tile at `spread` per cent, to at most `most` per cent. */
function spreadBlight(ctx: SystemContext, f: EntityRow): void {
  const { world, content } = ctx;
  const { spread, most } = content.buildings.field.blight;
  const width = world.map.width;
  const rng = streamFor(world, 'blight');
  const tiles = new Set(tilesOf(f));
  const sick = ints(f, 'blight');
  const limit = Math.max(1, Math.floor((tiles.size * most) / 100));
  for (const i of [...sick]) {
    const x = i % width;
    for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width])
      if (sick.length < limit && tiles.has(n) && !sick.includes(n) && rng.chance(spread / 100))
        sick.push(n);
  }
}

/** Once a day, from the hourly field tick: yesterday's dry losses, the wet-day count, then blight. */
export function tickBlight(ctx: SystemContext, fields: EntityRow[]): void {
  const { world, content, state } = ctx;
  const day = Math.floor(world.tick / TICKS_PER_DAY) + 1;
  if (state['blightDay'] === day) return;
  state['blightDay'] = day;
  const sown = fields.filter((f) => f['state'] === 'sown');
  // Yesterday was dry: the far tiles nobody watered lost a day's yield.
  if (state['wasDry'])
    for (const f of sown) {
      const watered = ints(f, 'watered');
      tilesOf(f).forEach((i, k) => {
        if (!watered.includes(i) && farFromWater(world, content, i))
          ints(f, 'dry')[k] = (ints(f, 'dry')[k] ?? 0) + 1;
      });
    }
  for (const f of fields) f['watered'] = [];
  state['wasDry'] = dryToday(world, content) ? 1 : 0;
  const { span, start, spreadAt, oneIn, repeatIn } = content.buildings.field.blight;
  state['wetBits'] =
    (((state['wetBits'] ?? 0) << 1) | (world.systems['weather']?.['wet'] ? 1 : 0)) &
    ((1 << span) - 1);
  const wet = wetDays(world);
  const rng = streamFor(world, 'blight');
  for (const f of sown) {
    if (!ints(f, 'blight').length) {
      const again = ((f['prev'] as string) || '').split(',').includes(f['crop'] as string);
      if (wet >= start && rng.chance(1 / (again ? repeatIn : oneIn)))
        startBlight(ctx, f, wet, again);
    } else if (world.systems['weather']?.['wet'] && wet >= spreadAt) spreadBlight(ctx, f);
  }
}
