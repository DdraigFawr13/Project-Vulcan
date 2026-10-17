// Seasons and daily weather (P1.4): each midnight, after the calendar's line, the valley's weather
// may change spell, drawn from the forked weather kinds by season and rainfall, and the day's
// temperature follows from the climate (map.temperature), the month and the spell. Every tile is
// colder with height above the valley floor. Still water (lakes) counts freezing degree-days and
// freezes, shallow before deep; springs and running water never freeze (Morgan, 2026-10-17).
import { clockAt, WATER, type EngineContent, type MapState } from '../core/index.ts';
import { raiseChunk } from '../map/index.ts';
import type { System, SystemContext } from '../sim/index.ts';

const LAKE = WATER.indexOf('lake');
/** `map.ice` keeps the freezing degree-days in its low 7 bits and whether the tile is frozen in
 * the top bit, so the chunks can carry it as it is. */
const FROZEN = 0x80;
const COUNT = 0x7f;

/** Whether surface tile `i` is frozen over. */
export const isFrozen = (map: MapState, i: number): boolean => (map.ice[i]! & FROZEN) !== 0;

/** The temperature (whole degrees C) at surface tile `i` when the valley floor is at `floorTemp`. */
export function tileTemperature(
  content: EngineContent,
  map: MapState,
  floorTemp: number,
  i: number,
): number {
  const above = Math.max(0, map.elevation[i]! - map.floor);
  return Math.round(floorTemp - (content.terrain.generator.elevation.lapse * above) / 1000);
}

/** The words for a spell of weather kind `kind` (an index into content.weather) at `temp`. */
export function weatherWords(content: EngineContent, kind: number, temp: number): string {
  const def = seasonal(content, kind);
  return (def.words.find((w) => temp < w.below) ?? def.words.at(-1)!).words;
}

const seasonal = (content: EngineContent, kind: number) => {
  const id = content.weather[kind]!.id;
  const def = content.seasons.kinds.find((k) => k.weather === id);
  if (!def) throw new Error(`seasons.json has no entry for the weather "${id}".`);
  return def;
};

/** The latest calendar line, written earlier in this tick: what a weather line cites. */
function today(ctx: SystemContext): number {
  const log = ctx.world.log;
  for (let k = log.length - 1; k >= 0 && log[k]!.tick === ctx.world.tick; k -= 1)
    if (log[k]!.type.startsWith('calendar.')) return log[k]!.id;
  return ctx.world.begunEvent;
}

/** Draws the day: maybe a new spell, then the temperature and whether it rains or snows. */
function drawDay(ctx: SystemContext, fresh: boolean): boolean {
  const { content, world, state } = ctx;
  const rng = ctx.rng();
  const clock = clockAt(world.tick, content.calendar);
  const season = content.calendar.seasons[clock.season]!;
  let changed = false;
  if (fresh || rng.chance(content.seasons.change)) {
    const wetness = world.map.rainfall / content.seasons.rainfall;
    const kind = rng.weighted(
      content.weather.map((w, k) => {
        const base = (w.seasonWeights[season] ?? 0) * 4;
        const scaled = w.id === 'wet' ? base * wetness : w.id === 'dry' ? base / wetness : base;
        return [k, Math.round(scaled)] as const;
      }),
    );
    changed = fresh || kind !== state['kind'];
    state['kind'] = kind;
  }
  const def = seasonal(content, state['kind']!);
  const { jitter, months } = content.seasons;
  state['temp'] =
    Math.round(world.map.temperature + months[clock.month]! + def.shift) +
    rng.between(-jitter, jitter);
  state['wet'] = rng.chance(def.wet) ? 1 : 0;
  return changed;
}

/** One day of freezing and thawing on every lake tile; returns how many are frozen and of how many. */
function freeze(ctx: SystemContext): { frozen: number; lakes: number } {
  const { content, world } = ctx;
  const map = world.map;
  const dials = content.seasons.ice;
  const { kinds } = content.terrain;
  let frozen = 0;
  let lakes = 0;
  for (let i = 0; i < map.water.length; i += 1) {
    if (map.water[i] !== LAKE) continue;
    lakes += 1;
    const t = tileTemperature(content, map, ctx.state['temp']!, i);
    const was = map.ice[i]!;
    const count = Math.max(0, Math.min(dials.cap, (was & COUNT) - (t < 0 ? t : dials.thaw * t)));
    const need = kinds[map.tiles[i]!]!.water === 'deep' ? dials.deep : dials.shallow;
    const now = count | (count >= need ? FROZEN : 0);
    map.ice[i] = now;
    if (now & FROZEN) frozen += 1;
    if ((now ^ was) & FROZEN) raiseChunk(map, i % map.width, Math.floor(i / map.width));
  }
  return { frozen, lakes };
}

export const weatherSystem: System = {
  id: 'weather',
  every: 'day',
  stream: 'weather',
  emits: ['weather.changed', 'weather.iceFormed', 'weather.frozenOver', 'weather.thawed'],
  initialState: { kind: 0, temp: 0, wet: 0, spell: 0, frozen: 0, over: 0 },
  init(ctx) {
    drawDay(ctx, true);
    spellLine(ctx);
  },
  run(ctx) {
    if (drawDay(ctx, false)) spellLine(ctx);
    const { state } = ctx;
    const before = state['frozen']!;
    const { frozen, lakes } = freeze(ctx);
    state['frozen'] = frozen;
    const cause = { causes: [state['spell']!] };
    if (before === 0 && frozen > 0) ctx.emit('weather.iceFormed', cause);
    const over = lakes > 0 && frozen >= ctx.content.seasons.ice.over * lakes;
    if (over && !state['over']) ctx.emit('weather.frozenOver', cause);
    state['over'] = over ? 1 : 0;
    if (before > 0 && frozen === 0) ctx.emit('weather.thawed', cause);
  },
};

function spellLine(ctx: SystemContext): void {
  const temp = ctx.state['temp']!;
  ctx.state['spell'] = ctx.emit('weather.changed', {
    causes: [today(ctx)],
    data: { words: weatherWords(ctx.content, ctx.state['kind']!, temp), temperature: temp },
  });
}
