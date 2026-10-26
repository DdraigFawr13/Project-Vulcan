// Fields (P4.7, V-049, V-051, V-089): the Build sheet's Fields row says how much the colony wants
// them; nobody is told where. Each hour, while the band's field tiles are short of `perMouth`
// for each living person and no field waits to be sown, the colony sites one outside the town
// ring (fieldsite.ts: one compact block, the nearest good soil); its trees are marked to fell when sowing needs the ground (fieldlife.ts). A plan may be sent back once. Growing,
// frost, ripening and leaving the ground to grass are fieldlife.ts; sowing and reaping are
// people/farm.ts.
import {
  clockAt,
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { marksOf, raiseStock } from '../goods/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { tileTemperature } from '../weather/index.ts';
import { clearBlight } from './blight.ts';
import { chooseField } from './fieldsite.ts';
import { courseNow, meanSoil } from './fieldsoil.ts';
import { dirFrom, FIELD_KIND, wantOf } from './houses.ts';

export const FIELD_TABLES: Schemas = {
  /** A field. `state`: `plan` (to sow, or part sown), `sown`, `ripe`, `fallow` (reaped or lost,
   * waiting for a sowing month), or `sent` (sent back: its tiles are never chosen again).
   * `tiles` are the tile indices (y * width + x); `done` those sown (while `plan` or `fallow`)
   * or reaped (while `ripe`); `crop` the crop id once sowing begins; `sown` the tick it was
   * sown; `line` the line that sited it, `last` the latest line of its life, `took` the latest
   * taking up of its sowing or reaping; `why` the reason it gives; `sent` 1 for a plan that
   * replaced one sent back; `leave` the town-ring line that marks it to be left to grass after
   * its next harvest; `got` and `kept` the harvest laid so far (the rest, and what was kept as
   * seed); `reapers` the people who reaped it; `noSeed` the season (year * 4 + season) the
   * no-seed alert was last said; `at` the tile its lines name (its first tile when sited);
   * `course` its place in the rotation (fieldsoil.ts); `prev` the last two crops it bore,
   * `rested` the month (year * months + month + 1) its rest was last said; `blight` the tiles
   * blighted, `dry` the dry days each tile has lost (parallel to `tiles`), `watered` the tiles
   * watered today, `cut` the per cent grown when it was cut early (blight.ts). */
  field: {
    crop: 'text',
    state: 'text',
    tiles: 'ints',
    done: 'ints',
    sown: 'int',
    line: 'event',
    last: 'event',
    took: 'event',
    why: 'text',
    sent: 'count',
    leave: 'event',
    got: 'count',
    kept: 'count',
    reapers: 'ints',
    noSeed: 'count',
    at: 'int',
    course: 'int',
    prev: 'text',
    rested: 'int',
    blight: 'ints',
    dry: 'ints',
    watered: 'ints',
    cut: 'count',
    wline: 'event',
  },
};

export const fieldsOf = (world: WorldState): EntityRow[] => world.entities['field'] ?? [];

/** Fields that stand or are planned (not sent back). */
export const liveFields = (world: WorldState): EntityRow[] =>
  fieldsOf(world).filter((f) => f['state'] !== 'sent');

export const tilesOf = (f: EntityRow): number[] => f['tiles'] as number[];
export const doneOf = (f: EntityRow): number[] => f['done'] as number[];

/** A crop of content `buildings.field.crops`. */
export const cropOf = (content: EngineContent, id: string) =>
  content.buildings.field.crops.find((c) => c.id === id);

/** The crop that may be sown on field `f` now: the one it already has, if this is still a month
 * to sow it in; else its rotation's (fieldsoil.ts), none while its soil is under `soil.rest`;
 * with no field, the first crop (content order) with this month to sow. */
export function cropNow(world: WorldState, content: EngineContent, f?: EntityRow) {
  const month = content.calendar.monthNames[clockAt(world.tick, content.calendar).month] ?? '';
  const crops = content.buildings.field.crops;
  if (f && !f['crop']) {
    const pick = courseNow(content, f, month);
    return pick && meanSoil(world, f) >= content.buildings.field.soil.rest ? pick.crop : undefined;
  }
  const own = f && f['crop'] ? cropOf(content, f['crop'] as string) : undefined;
  return own
    ? own.sow.includes(month)
      ? own
      : undefined
    : crops.find((c) => c.sow.includes(month));
}

/** Whether a tile of the field is colder than the crop's frost line today. */
export function frosty(world: WorldState, content: EngineContent, f: EntityRow, frost: number) {
  const temp = world.systems['weather']?.['temp'] ?? 0;
  return tilesOf(f).some((i) => tileTemperature(content, world.map, temp, i) < frost);
}

/** The crop people may sow on field `f` today: `cropNow`, unless a frost would kill it at once
 * (nobody sows into a frost). */
export function sowNow(world: WorldState, content: EngineContent, f: EntityRow) {
  const crop = cropNow(world, content, f);
  return crop && !frosty(world, content, f, crop.frost) ? crop : undefined;
}

/** The year and season as one number, for "once a season". */
export function seasonKey(world: WorldState, content: EngineContent): number {
  const c = clockAt(world.tick, content.calendar);
  return c.year * content.calendar.seasons.length + c.season;
}

/** Where its lines say the field is: its first tile when sited, kept as its tiles change. */
export function placeOf(world: WorldState, f: EntityRow): { x: number; y: number } {
  const i = f['at'] as number;
  return { x: i % world.map.width, y: Math.floor(i / world.map.width) };
}

/** Removes the field and the tree marks of its site. */
export function dropField(world: WorldState, f: EntityRow): void {
  for (const m of marksOf(world).filter((m) => m['house'] === f.id))
    removeEntity(world, 'mark', m.id);
  removeEntity(world, 'field', f.id);
}

/** The field tiles the band has (not counting fields marked to be left), and what it needs. */
function tallyOf(ctx: SystemContext): { alive: number; have: number; need: number } {
  const { world, content } = ctx;
  const alive = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive').length;
  const have = liveFields(world)
    .filter((f) => !f['leave'])
    .reduce((n, f) => n + tilesOf(f).length, 0);
  return { alive, have, need: alive * content.buildings.field.perMouth };
}

/** Sites a field if the Fields level calls for one: said with the need first, then the plan, or
 * one alert while no good soil outside the ring fits. `sent` marks a plan replacing one sent
 * back. */
export function planFields(ctx: SystemContext, green: Spot, causes: number[], sent = 0): void {
  const { world, content, state } = ctx;
  const { alive, have, need } = tallyOf(ctx);
  if (liveFields(world).some((f) => f['state'] === 'plan') || have >= need) {
    if (have >= need) state['fieldNeed'] = 0;
    return;
  }
  const want = wantOf(world, content, FIELD_KIND);
  if (!state['fieldNeed']) {
    const first = (world.entities['person'] ?? []).find((p) => p['status'] === 'alive');
    state['fieldNeed'] = ctx.emit('field.needed', {
      causes: [
        ...(want.line ? [want.line] : []),
        ...[(first?.['arrived'] as number) ?? 0].filter((l) => l > 0),
      ],
      data: { people: `${alive} ${alive > 1 ? 'people' : 'person'}`, need: need - have },
    });
  }
  // With no ground found, the colony looks again once a day.
  if (state['fieldNoGround'] && !sent && world.tick < state['fieldTried']! + TICKS_PER_DAY) return;
  state['fieldTried'] = world.tick;
  const avoid = new Set(
    fieldsOf(world)
      .filter((f) => f['state'] === 'sent')
      .flatMap((f) => tilesOf(f)),
  );
  const site = chooseField(world, content, green, need - have, avoid);
  if (!site) {
    if (!state['fieldNoGround'])
      state['fieldNoGround'] = ctx.emit('field.noGround', { causes: [state['fieldNeed']!] });
    return;
  }
  state['fieldNoGround'] = 0;
  const map = world.map;
  const xs = site.tiles.map((i) => i % map.width);
  const ys = site.tiles.map((i) => Math.floor(i / map.width));
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  const dir = dirFrom(green, { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 });
  const water = content.buildings.field.water;
  const why =
    `the nearest good soil outside the town ring, ${site.far} tiles from the green, ` +
    `${site.wet <= 1 ? 'by' : site.wet > water ? 'far from' : `${site.wet} tiles from`} water: ` +
    `fertility ${site.fert}, ` +
    (site.trees.length
      ? `${site.trees.length} tree${site.trees.length > 1 ? 's' : ''} on it`
      : 'no trees on it');
  const line = ctx.emit('field.sited', {
    causes: [state['fieldNeed']!, ...causes],
    data: { tiles: site.tiles.length, dir, why },
  });
  addEntity(world, 'field', {
    ...{ crop: '', state: 'plan', tiles: site.tiles, done: [], sown: 0, line, last: line },
    ...{ took: 0, why, sent, leave: 0, got: 0, kept: 0, reapers: [], noSeed: 0 },
    ...{ course: 0, prev: '', rested: 0, wline: 0, ...clearBlight() },
    at: site.tiles[0]!,
  });
  raiseStock(ctx, content.buildings.field.seed, content.buildings.field.name.toLowerCase(), line);
}

/** The `sendBack {field}` lever (V-049): a field still planned, with nothing sown and not itself
 * a replacement, is dropped; its site is never chosen again and the colony chooses again at
 * once. */
export function sendBackField(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
  green: Spot,
): void {
  const { world } = ctx;
  const f = fieldsOf(world).find((r) => r.id === data['field']);
  const why =
    !f || f['state'] !== 'plan'
      ? 'no such plan'
      : f['sent']
        ? 'it was sent back once already'
        : doneOf(f).length
          ? 'sowing has begun'
          : undefined;
  if (why) {
    ctx.emit('command.refused', { causes: [cause], data: { kind: 'sendBack', reason: why } });
    return;
  }
  const line = ctx.emit('field.sentBack', { causes: [cause, f!['line'] as number] });
  for (const m of marksOf(world).filter((m) => m['house'] === f!.id))
    removeEntity(world, 'mark', m.id);
  f!['state'] = 'sent';
  planFields(ctx, green, [line], 1);
}
