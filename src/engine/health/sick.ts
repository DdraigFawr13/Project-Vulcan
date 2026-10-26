// Sickness (P5.7, V-136): illnesses are content (health.json `ills`), each caught from a cause the
// colony lives with. The health system counts the cold (a day with `sick.coldHours` hours at no
// warmth); the people's drinking, eating and strangers call `expose` for a foul drink, a turning
// meal or a world disease. Caught, it shows after the illness's own days; an abed illness lays
// them down (body `down`), so the people find a bed for them, the sickroom first, and feed them.
// Some cases turn grave halfway; a grave case may die at its end, less often for each skill point
// of the healer who gave it a draught (people/draught.ts). Each night the sick give a catching
// illness to whoever is in the same room. Once over, it cannot come back for `immune` days.
import { TICKS_PER_DAY, WATER, clockAt, type EntityRow, type WorldState } from '../core/index.ts';
import type { EngineContent, IllDef } from '../core/index.ts';
import { roomAt } from '../build/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { die } from './death.ts';
import { soapCut, soapWeek } from './soap.ts';
import { bodyOf, ensureBody, pronouns, stopFor } from './wounds.ts';

export const SICK_TABLES: Schemas = {
  /** One a bout of illness: `ill` a content id; `state` `coming` (caught, not yet showing),
   * `sick`, `over` or `closed` (at death or when a stranger left); ticks `caught`, `shows`,
   * `ends`, and `crisis` (0, or when a grave case turns); `grave` 1 once it has turned; `how` the
   * cause in words; `water` the tile drunk from + 1 (a flux) or 0; `from` who gave it (0 none);
   * `cause` the line it was caught under, `line` the line it showed under, `turned` the grave
   * line; `healer` who last gave a draught, at `draught` (tick), and `cut` the per cent it takes
   * off a grave case's death chance; `herbless` the tick a draught found no herbs (0 never). */
  ill: {
    person: 'entity',
    ill: 'text',
    state: 'text',
    caught: 'int',
    shows: 'int',
    ends: 'int',
    crisis: 'int',
    grave: 'count',
    how: 'text',
    water: 'int',
    from: 'entity',
    cause: 'event',
    line: 'event',
    turned: 'event',
    healer: 'entity',
    draught: 'int',
    cut: 'count',
    herbless: 'int',
  },
  /** Hours today with warmth at nothing, per person (`day` the game day counted). */
  chilled: { person: 'entity', day: 'int', hours: 'count' },
};

export const illsOf = (world: WorldState): EntityRow[] => world.entities['ill'] ?? [];
export const illDef = (content: EngineContent, id: string): IllDef | undefined =>
  content.health.ills.find((d) => d.id === id);

/** Their bout now, coming or showing. */
export const boutOf = (world: WorldState, person: number): EntityRow | undefined =>
  illsOf(world).find(
    (r) => r['person'] === person && (r['state'] === 'coming' || r['state'] === 'sick'),
  );

/** Showing an illness that keeps them abed. */
export function abedSick(world: WorldState, content: EngineContent, person: number): boolean {
  const r = boutOf(world, person);
  return !!r && r['state'] === 'sick' && !!illDef(content, r['ill'] as string)?.abed;
}

/** Whether `person` cannot take `ill` now: already ill, or over it within its immune days. */
function guarded(ctx: SystemContext, person: number, def: IllDef): boolean {
  if (boutOf(ctx.world, person)) return true;
  return illsOf(ctx.world).some(
    (r) =>
      r['person'] === person &&
      r['ill'] === def.id &&
      r['state'] === 'over' &&
      (def.immune < 0 || ctx.world.tick < (r['ends'] as number) + def.immune * TICKS_PER_DAY),
  );
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const lineData = (p: EntityRow, def: IllDef, how: string) => ({
  name: p['name'] as string,
  ill: def.name,
  Ill: cap(def.name),
  a: def.a,
  how,
});

/** One exposure of `p` to illness `id` (`how`: "drank from the lake in the warm weather"):
 * caught at the illness's chance (always with `sure`), unless they are ill or immune. Shows at
 * once with its line, or after its `shows` days. The new bout, or undefined. */
export function expose(
  ctx: SystemContext,
  p: EntityRow,
  id: string,
  how: string,
  causes: readonly number[],
  opts: { sure?: boolean; water?: number; from?: number; shows?: number } = {},
): EntityRow | undefined {
  const { world, content } = ctx;
  const def = illDef(content, id);
  if (!def || guarded(ctx, p.id, def)) return undefined;
  const soap = content.health.sick.soap;
  const odds = soap.ills.includes(id) ? (def.catch * (100 - soapCut(world))) / 100 : def.catch;
  if (!opts.sure && ctx.rng().int(content.health.sick.per) >= odds) return undefined;
  const shows = world.tick + (opts.shows ?? def.shows) * TICKS_PER_DAY;
  const row = addEntity(world, 'ill', {
    ...{ person: p.id, ill: def.id, state: 'coming', caught: world.tick, shows, ends: 0 },
    ...{ crisis: 0, grave: 0, how, water: opts.water ?? 0, from: opts.from ?? 0 },
    ...{ cause: causes.find((c) => c > 0) ?? 0, line: 0, turned: 0, healer: 0, draught: 0 },
    ...{ cut: 0, herbless: 0 },
  });
  const bout = illsOf(world).find((r) => r.id === row)!;
  if (shows <= world.tick) show(ctx, p, bout, def);
  return bout;
}

/** It shows: the line; its length and whether it turns grave are drawn; abed, they lie down. */
function show(ctx: SystemContext, p: EntityRow, r: EntityRow, def: IllDef): void {
  const { world } = ctx;
  const [lo, hi] = def.days as [number, number];
  const days = lo + ctx.rng().int(hi - lo + 1);
  r['state'] = 'sick';
  r['ends'] = world.tick + days * TICKS_PER_DAY;
  if (ctx.rng().int(100) < def.grave)
    r['crisis'] = world.tick + Math.floor((days * TICKS_PER_DAY) / 2);
  r['line'] = ctx.emit(r['from'] ? 'health.spread' : 'health.sick', {
    causes: [r['cause'] as number].filter((c) => c > 0),
    actors: [p.id, ...(r['from'] ? [r['from'] as number] : [])],
    data: lineData(p, def, r['how'] as string),
  });
  if (r['water']) shun(ctx, p, r);
  layDown(ctx, p, r, def);
}

/** Abed with it, once one of the colony (a stranger lies down when let in): they know they are
 * ill, so nobody needs to find them, only to help them to a bed. */
function layDown(ctx: SystemContext, p: EntityRow, r: EntityRow, def: IllDef): void {
  if (!def.abed || p['status'] !== 'alive' || bodyOf(ctx.world, p.id)?.['down']) return;
  const body = ensureBody(ctx.world, ctx.content, p);
  stopFor(ctx, p, true);
  Object.assign(body, { down: 1, found: r['line'] as number, finder: 0 });
}

/** The flux shows: the band shuns the water it was drunk from for `sick.shun` days. */
function shun(ctx: SystemContext, p: EntityRow, r: EntityRow): void {
  const t = (r['water'] as number) - 1;
  ctx.emit('health.shunned', {
    causes: [r['line'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      water: WATER[ctx.world.map.water[t] ?? 0] || 'water',
      days: ctx.content.health.sick.shun,
    },
  });
}

/** The per cent chance a grave case dies now, after the healer's care. */
export const dyingChance = (def: IllDef, r: EntityRow): number =>
  Math.floor((def.dies * (100 - (r['cut'] as number))) / 100);

/** Over: the line, a lasting mark if the illness leaves one, or death for a grave case. */
function end(ctx: SystemContext, p: EntityRow, r: EntityRow, def: IllDef): void {
  const { world, content } = ctx;
  if (r['grave'] && ctx.rng().int(100) < dyingChance(def, r)) {
    r['state'] = 'closed';
    die(ctx, p, `${cap(def.graveName ?? def.name)} took ${pronouns(p).them}.`, [
      r['turned'] as number,
      r['line'] as number,
    ]);
    return;
  }
  r['state'] = 'over';
  r['ends'] = world.tick;
  const mark = content.health.marks.find((m) => m.id === def.mark);
  const line = ctx.emit('health.passed', {
    causes: [r['turned'] as number, r['line'] as number].filter((c) => c > 0),
    actors: [p.id],
    data: {
      ...lineData(p, def, ''),
      mark: mark ? `, but left ${pronouns(p).them} with a ${mark.name}` : '',
    },
  });
  if (mark) addEntity(world, 'scar', { person: p.id, mark: mark.id, part: mark.part ?? '', line });
}

/** A day at no warmth for `coldHours` hours: one exposure to the chill, citing the low line. */
function countCold(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const warmth = needOf(world, p.id, 'warmth');
  if (!warmth || (warmth['value'] as number) > 0) return;
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  let row = (world.entities['chilled'] ?? []).find((c) => c['person'] === p.id);
  if (!row) {
    addEntity(world, 'chilled', { person: p.id, day, hours: 0 });
    row = (world.entities['chilled'] ?? []).find((c) => c['person'] === p.id)!;
  }
  if (row['day'] !== day) Object.assign(row, { day, hours: 0 });
  row['hours'] = (row['hours'] as number) + 1;
  if (row['hours'] !== content.health.sick.coldHours) return;
  const asleep = p['doing'] === 'sleep';
  const how = `${row['hours']} hours cold through${asleep ? ' in the night' : ', out at work'}`;
  expose(ctx, p, 'chill', how, [warmth['line'] as number]);
}

/** Each night at `sick.night`: each sick person gives a catching illness to whoever else is in
 * their room, at its `spread` chance; someone out of doors gives it to nobody. */
function spreadNight(ctx: SystemContext): void {
  const { world, content } = ctx;
  const people = (world.entities['person'] ?? []).filter((q) => q['status'] === 'alive');
  for (const r of illsOf(world).filter((x) => x['state'] === 'sick')) {
    const def = illDef(content, r['ill'] as string);
    const p = people.find((q) => q.id === r['person']);
    if (!def?.spread || !p || (p['z'] as number) > 0) continue;
    const room = roomAt(world, content, p['x'] as number, p['y'] as number);
    if (!room) continue;
    const tiles = new Set(room.tiles);
    const width = world.map.width;
    for (const q of people) {
      if (q.id === p.id || (q['z'] as number) > 0) continue;
      if (!tiles.has((q['y'] as number) * width + (q['x'] as number))) continue;
      if (ctx.rng().int(content.health.sick.per) >= (def.spread * (100 - soapCut(world))) / 100)
        continue;
      expose(ctx, q, def.id, `shares ${p['name']}'s room`, [r['line'] as number], {
        sure: true,
        from: p.id,
      });
    }
  }
}

/** One hour of sickness for everyone. */
export function sickHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  soapWeek(ctx);
  for (const p of world.entities['person'] ?? [])
    if (p['status'] === 'alive' && (p['z'] as number) === 0) countCold(ctx, p);
  for (const r of illsOf(world)) {
    const state = r['state'];
    if (state !== 'coming' && state !== 'sick') continue;
    const p = (world.entities['person'] ?? []).find((q) => q.id === r['person']);
    const def = illDef(content, r['ill'] as string);
    if (!p || !def || (p['status'] !== 'alive' && p['status'] !== 'stranger')) {
      r['state'] = 'closed';
      continue;
    }
    if (state === 'coming') {
      if (world.tick >= (r['shows'] as number)) show(ctx, p, r, def);
      continue;
    }
    layDown(ctx, p, r, def);
    if (r['crisis'] && !r['grave'] && world.tick >= (r['crisis'] as number)) {
      r['grave'] = 1;
      r['turned'] = ctx.emit('health.grave', {
        causes: [r['line'] as number],
        actors: [p.id],
        data: { ...lineData(p, def, ''), grave: def.graveName ?? `a grave ${def.name}` },
      });
    }
    if (world.tick >= (r['ends'] as number)) end(ctx, p, r, def);
  }
  if (clockAt(world.tick, content.calendar).hour === content.health.sick.night) spreadNight(ctx);
}

/** Whether drinking at surface tile `tile` is shunned: a flux was caught within
 * `sick.shunNear` tiles of it in the last `sick.shun` days, once it showed. */
export function shunned(world: WorldState, content: EngineContent, tile: number): boolean {
  const s = content.health.sick;
  const w = world.map.width;
  const [x, y] = [tile % w, Math.floor(tile / w)];
  return illsOf(world).some((r) => {
    const t = (r['water'] as number) - 1;
    if (
      t < 0 ||
      r['state'] === 'coming' ||
      world.tick - (r['caught'] as number) >= s.shun * TICKS_PER_DAY
    )
      return false;
    return Math.max(Math.abs((t % w) - x), Math.abs(Math.floor(t / w) - y)) <= s.shunNear;
  });
}
