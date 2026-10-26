// Seasons and daily weather (P1.4): each midnight, after the calendar's line, the valley's weather
// may change spell, drawn from the forked weather kinds by season and rainfall, and the day's
// temperature follows from the climate (map.temperature), the month and the spell. Every tile is
// colder with height above the valley floor. Water counts freezing degree-days and freezes: lakes,
// shallow before deep, then streams and the river after a long hard frost (V-150, replacing
// "running water never freezes"); springs never freeze.
import { clockAt, WATER, type EngineContent, type MapState } from '../core/index.ts';
import { raiseChunk } from '../map/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { settleSnow } from './snow.ts';
import { tileTemperature } from './temperature.ts';

const LAKE = WATER.indexOf('lake');
const STREAM = WATER.indexOf('stream');
const RIVER = WATER.indexOf('river');
/** `map.ice` keeps the freezing degree-days in its low 7 bits and whether the tile is frozen in
 * the top bit, so the chunks can carry it as it is. */
const FROZEN = 0x80;
const COUNT = 0x7f;

/** Whether surface tile `i` is frozen over. */
export const isFrozen = (map: MapState, i: number): boolean => (map.ice[i]! & FROZEN) !== 0;

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

/** Freezing degree-days surface tile `i` of water body `body` needs to freeze, or 0 if it never does. */
function needOf(content: EngineContent, map: MapState, body: number, i: number): number {
  const dials = content.seasons.ice;
  if (body === LAKE)
    return content.terrain.kinds[map.tiles[i]!]!.water === 'deep' ? dials.deep : dials.shallow;
  if (body === STREAM) return dials.stream;
  if (body === RIVER) return dials.river;
  return 0;
}

/** One day of freezing and thawing on every lake, stream and river tile; returns how many lake tiles
 * are frozen, of how many, how many running-water tiles are frozen, how many river tiles are frozen
 * of how many, and the tiles that froze or thawed today. */
function freeze(ctx: SystemContext): {
  frozen: number;
  lakes: number;
  running: number;
  river: number;
  rivers: number;
  flips: number[];
} {
  const { content, world } = ctx;
  const map = world.map;
  const dials = content.seasons.ice;
  let frozen = 0;
  let lakes = 0;
  let running = 0;
  let river = 0;
  let rivers = 0;
  const flips: number[] = [];
  for (let i = 0; i < map.water.length; i += 1) {
    const body = map.water[i]!;
    const need = body ? needOf(content, map, body, i) : 0;
    if (!need) continue;
    if (body === LAKE) lakes += 1;
    if (body === RIVER) rivers += 1;
    const t = tileTemperature(content, map, ctx.state['temp']!, i);
    const was = map.ice[i]!;
    const count = Math.max(0, Math.min(dials.cap, (was & COUNT) - (t < 0 ? t : dials.thaw * t)));
    const now = count | (count >= need ? FROZEN : 0);
    map.ice[i] = now;
    if (now & FROZEN) {
      if (body === LAKE) frozen += 1;
      else running += 1;
      if (body === RIVER) river += 1;
    }
    if ((now ^ was) & FROZEN) {
      flips.push(i);
      raiseChunk(map, i % map.width, Math.floor(i / map.width));
    }
  }
  return { frozen, lakes, running, river, rivers, flips };
}

export const weatherSystem: System = {
  id: 'weather',
  every: 'day',
  stream: 'weather',
  emits: [
    'weather.changed',
    'weather.iceFormed',
    'weather.frozenOver',
    'weather.thawed',
    'weather.iceSpread',
    'weather.iceShrank',
    'weather.riverFrozen',
    'weather.riverThawed',
    'weather.snowSettled',
    'weather.snowMelted',
  ],
  initialState: {
    ...{ kind: 0, temp: 0, wet: 0, spell: 0, frozen: 0, over: 0, running: 0, riverOver: 0 },
    ...{ snowTiles: 0, snowing: 0, snowLine: 0 },
  },
  refs: ['spell', 'snowLine'],
  init(ctx) {
    drawDay(ctx, true);
    spellLine(ctx);
  },
  run(ctx) {
    if (drawDay(ctx, false)) spellLine(ctx);
    settleSnow(ctx);
    const { state } = ctx;
    const before = state['frozen']!;
    const ranBefore = state['running']!;
    const { frozen, lakes, running, river, rivers, flips } = freeze(ctx);
    state['frozen'] = frozen;
    state['running'] = running;
    const cause = { causes: [state['spell']!] };
    let line: number | undefined;
    // The river's lines: frozen once half of it is, open again once none of it is (V-150); high
    // streams freeze and thaw with no line of their own.
    const riverOver = rivers > 0 && river * 2 >= rivers;
    if (riverOver && !state['riverOver']) {
      line = ctx.emit('weather.riverFrozen', cause);
      state['riverOver'] = 1;
    } else if (state['riverOver'] && river === 0) {
      line = ctx.emit('weather.riverThawed', cause);
      state['riverOver'] = 0;
    }
    if (before === 0 && frozen > 0) line = ctx.emit('weather.iceFormed', cause);
    const over = lakes > 0 && frozen >= ctx.content.seasons.ice.over * lakes;
    if (over && !state['over']) line = ctx.emit('weather.frozenOver', cause);
    state['over'] = over ? 1 : 0;
    if (before > 0 && frozen === 0) line = ctx.emit('weather.thawed', cause);
    if (flips.length === 0) return;
    // Any other day the ice grows or shrinks gets a line too, and every tile that froze or thawed
    // cites the day's ice line, so the inspector can say since when (V-006).
    line ??= ctx.emit(
      frozen + running > before + ranBefore ? 'weather.iceSpread' : 'weather.iceShrank',
      cause,
    );
    for (const i of flips) ctx.world.map.tileCauses[i] = line;
  },
};

function spellLine(ctx: SystemContext): void {
  const temp = ctx.state['temp']!;
  ctx.state['spell'] = ctx.emit('weather.changed', {
    causes: [today(ctx)],
    data: { words: weatherWords(ctx.content, ctx.state['kind']!, temp), temperature: temp },
  });
}
