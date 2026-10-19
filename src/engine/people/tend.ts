// Tending (P3.6, V-044, V-048): the Tend row of the Work sheet. Nobody is told to feed a fire. A
// free person looking for work tends, in this order: (a) a lit fire with under `tend.low` minutes
// of fuel whose room was used within `tend.idle` minutes, (b) an unlit hearth whose room is in use
// or with someone cold near it, (c) splitting logs at the store into firewood while the colony
// has less than its Firewood plate asks, (d) topping up a lit, used fire that is under
// `tend.topBelow` to at most `tend.top`. A fire nobody has used for `tend.idle` minutes is left to
// burn down (fire/system.ts says so when it goes out). Tending a fire: fetch the fuel from where it
// lies, go beside the hearth, add pieces, and light it if it is out. Splitting: work at the store's
// log stack, then carry the firewood onto its stack (haul.ts). The cold do the same for
// themselves when no warm place is to be had (warm.ts, V-046).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { furnitureOf } from '../build/index.ts';
import { fireOf, firesOf, fuelOf, pieceOfFire, placeOf } from '../fire/index.ts';
import { occupied } from './hearth.ts';
import {
  haveOf,
  inStore,
  itemsOf,
  layItem,
  loadOf,
  stockOf,
  takeFrom,
  wantOf,
} from '../goods/index.ts';
import { needOf } from '../needs/index.ts';
import { canReach } from '../paths/index.ts';
import { tileTemperature } from '../weather/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stackOf } from './build.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { goBeside, people, same, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** What `p` would do: tend a fire (`fire` and the fuel `item` to fetch) or split `logs`. */
export interface Pick {
  fire?: EntityRow;
  item?: string;
  logs?: EntityRow;
  /** Logs to split. */
  n: number;
  why: string;
  cause: number;
}

const FUEL_JOB = 'tend';

const lowOf = (content: EngineContent): number =>
  content.life.needs.find((n) => n.id === 'warmth')?.low ?? 0;

/** Whether `q` is cold: warmth under its warning line. */
export const isCold = (world: WorldState, content: EngineContent, q: EntityRow): boolean =>
  ((needOf(world, q.id, 'warmth')?.['value'] as number) ?? Infinity) < lowOf(content);

function stop(p: EntityRow): false {
  p['job'] = '';
  p['plan'] = 0;
  p['target'] = -1;
  return false;
}

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** The log stack in the store nearest `p` that they can reach. */
function logsOf(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const from = spotOf(p);
  let best: EntityRow | undefined;
  let far = Infinity;
  for (const i of itemsOf(world)) {
    if (i['kind'] !== content.work.fire.split.from || i['holder']) continue;
    const at = spotOf(i);
    if (!inStore(world, at.x, at.y, at.z) || cheb(at, from) >= far) continue;
    if (canReach(content, world.map, from, at)) [best, far] = [i, cheb(at, from)];
  }
  return best;
}

/** The fuel item to fetch for a fire: the one it burns, else the first a stack of can be reached. */
function fuelFor(ctx: SystemContext, p: EntityRow, fire: EntityRow): string | undefined {
  const { content } = ctx;
  const burning =
    fire['fuel'] && fire['kind'] ? fuelOf(content, fire['kind'] as string) : undefined;
  const fuels = burning ? [burning] : content.work.fire.fuels;
  return fuels.find((f) => stackOf(ctx, p, f.item))?.item;
}

/** What `p` would take up, in the order of the header; `cold` is a cold person lighting a fire
 * for themselves (any fire that is out or low, used or not). */
function pick(ctx: SystemContext, p: EntityRow, cold = false): Pick | undefined {
  const { world, content } = ctx;
  const t = content.work.fire.tend;
  const from = spotOf(p);
  const on = new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === FUEL_JOB)
      .map((q) => q['plan']),
  );
  const fires = firesOf(world)
    .map((f) => ({ f, piece: pieceOfFire(world, f) }))
    .filter(({ piece }) => !on.has(piece.id))
    .sort((a, b) => cheb(from, spotOf(a.piece)) - cheb(from, spotOf(b.piece)) || a.f.id - b.f.id);
  const recent = (f: EntityRow) => world.tick - (f['used'] as number) < t.idle;
  // A fire is lit or fed only where its tile is under the hearth line without one (V-068).
  const chilly = (piece: EntityRow) =>
    tileTemperature(
      content,
      world.map,
      world.systems['weather']?.['temp'] ?? 0,
      (piece['y'] as number) * world.map.width + (piece['x'] as number),
    ) < content.buildings.rooms.hearthBelow;
  const tendIt = (f: EntityRow, piece: EntityRow, why: string): Pick | undefined => {
    const item = fuelFor(ctx, p, f);
    return item
      ? {
          fire: f,
          item,
          n: 0,
          why: `the fire ${placeOf(world, content, piece).where} ${why}`,
          cause: f['line'] as number,
        }
      : undefined;
  };
  const left = (f: EntityRow) => `has ${f['fuel'] as number} minutes of fuel left`;
  for (const { f, piece } of fires)
    if (f['lit'] && (f['fuel'] as number) < t.low && (cold || (recent(f) && chilly(piece)))) {
      const got = tendIt(f, piece, `is low: it ${left(f)}`);
      if (got) return got;
    }
  for (const { f, piece } of fires) {
    if (f['lit'] || (!cold && !chilly(piece))) continue;
    const near = people(world).some(
      (q) =>
        q['status'] === 'alive' &&
        q['z'] === 0 &&
        cheb(spotOf(q), spotOf(piece)) <= t.near &&
        isCold(world, content, q),
    );
    if (!cold && !occupied(world, content, piece) && !near) continue;
    const got = tendIt(
      f,
      piece,
      `is out and ${cold || near ? 'someone near it is cold' : 'the room is in use'}`,
    );
    if (got) return got;
  }
  if (cold) return undefined;
  const split = content.work.fire.split;
  const fuel = fuelOf(content, split.fuel);
  const want = fuel ? wantOf(world, content, fuel.item) : 0;
  const have = fuel ? haveOf(world, content, fuel.item) : 0;
  const busy = people(world).some(
    (q) => q.id !== p.id && q['job'] === FUEL_JOB && (q['plan'] as number) < 0,
  );
  const logs = fuel && want > have && !busy ? logsOf(ctx, p) : undefined;
  if (fuel && logs) {
    const n = Math.min(
      Math.ceil((want - have) / split.per),
      logs['count'] as number,
      Math.max(1, Math.floor(content.work.haul.load / split.per)),
    );
    const plate = stockOf(world, fuel.item);
    return {
      logs,
      n,
      why: `the colony wants more ${fuel.item} (${have} of ${want})`,
      cause: (plate?.['line'] as number) || world.begunEvent,
    };
  }
  for (const { f, piece } of fires)
    if (f['lit'] && recent(f) && chilly(piece) && (f['fuel'] as number) < t.topBelow) {
      const got = tendIt(f, piece, `${left(f)}`);
      if (got) return got;
    }
  return undefined;
}

/** `p` takes up the pick: one line, then the first minute's work. */
function begin(ctx: SystemContext, p: EntityRow, got: Pick, extra: number[] = []): boolean {
  const { world, content } = ctx;
  p['took'] = ctx.emit('work.tookUpTending', {
    causes: [got.cause, priorityLine(world, p.id, FUEL_JOB), ...extra].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: { name: p['name'] as string, why: got.why },
  });
  p['job'] = FUEL_JOB;
  p['target'] = -1;
  if (got.fire) p['plan'] = got.fire['piece'] as number;
  else {
    p['plan'] = -got.n;
    p['work'] = got.n * content.work.fire.split.minutes;
  }
  return tending(ctx, p);
}

/** Takes up tending if there is a fire to feed or firewood to split and nobody free who puts
 * Tend higher could. */
export function takeUpTending(ctx: SystemContext, p: EntityRow): boolean {
  const { content } = ctx;
  if (!able(content, p, FUEL_JOB) || outranked(ctx, p, FUEL_JOB, (q) => pick(ctx, q) !== undefined))
    return false;
  const got = pick(ctx, p);
  return !!got && begin(ctx, p, got);
}

/** In the evening, after work hours and before bed, a free person may still feed a fire so it
 * lasts the night (the work hours gate the rest of the Work sheet). */
export function tendInEvening(ctx: SystemContext, p: EntityRow): boolean {
  if (ctx.world.tick < (p['next'] as number)) return false;
  if (takeUpTending(ctx, p)) return true;
  p['next'] = ctx.world.tick + 30;
  return false;
}

/** The nearest fire a cold person could light or feed for themselves: out or low, used or not. */
export const coldPick = (ctx: SystemContext, p: EntityRow): Pick | undefined => pick(ctx, p, true);

/** A cold person tends the fire `coldPick` found, their cold line cited. */
export function tendForWarmth(ctx: SystemContext, p: EntityRow, got: Pick): boolean {
  const row = needOf(ctx.world, p.id, 'warmth');
  return begin(ctx, p, got, [row?.['line'] as number]);
}

/** Picks the fuel up from the stack at their feet, or walks to it. */
function bringFuel(ctx: SystemContext, p: EntityRow, fire: EntityRow, wanted: number): boolean {
  const { world, content } = ctx;
  let item = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!item) {
    const kind = fuelFor(ctx, p, fire);
    item = kind ? stackOf(ctx, p, kind) : undefined;
    if (!item) return stop(p);
    p['target'] = item.id;
  }
  if (!same(spotOf(item), spotOf(p))) return walkTo(ctx, p, spotOf(item)) || stop(p);
  const count = Math.min(wanted, content.work.haul.load, item['count'] as number);
  if (count === (item['count'] as number)) item['holder'] = p.id;
  else {
    takeFrom(world, item, count);
    const id = layItem(world, {
      ...{ kind: item['kind'] as string, count, ...spotOf(p) },
      made: item['made'] as number,
    });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  p['target'] = -1;
  return true;
}

/** One minute of tending: false when it is done, gone or out of reach (what they carry then goes
 * back to the store). */
export function tending(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if ((p['plan'] as number) < 0) return splitting(ctx, p);
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  const fire = piece && fireOf(world, piece.id);
  if (!piece || !fire) return stop(p);
  const t = content.work.fire.tend;
  const load = loadOf(world, p.id);
  const fuel = content.work.fire.fuels.find((f) => f.item === load?.['kind']);
  const room = (minutes: number) => Math.floor((t.top - (fire['fuel'] as number)) / minutes);
  if (!load) {
    const first =
      content.work.fire.fuels.find((f) => f.id === fire['kind']) ?? content.work.fire.fuels[0]!;
    return bringFuel(ctx, p, fire, Math.max(1, room(first.minutes)));
  }
  if (!fuel || room(fuel.minutes) <= 0 || (fire['fuel'] && fire['kind'] !== fuel.id))
    return stop(p);
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) <= 1))
    return goBeside(ctx, p, x, y) || stop(p);
  const n = Math.min(load['count'] as number, room(fuel.minutes));
  takeFrom(world, load, n);
  fire['fuel'] = (fire['fuel'] as number) + n * fuel.minutes;
  fire['kind'] = fuel.id;
  fire['line'] = p['took'] as number;
  if (!fire['lit']) {
    const cold = isCold(world, content, p);
    const row = needOf(world, p.id, 'warmth');
    Object.assign(fire, { lit: 1, banked: 0, used: world.tick });
    fire['line'] = ctx.emit('fire.lit', {
      causes: [p['took'] as number, ...(cold ? [row?.['line'] as number] : [])],
      actors: [p.id],
      data: {
        name: p['name'] as string,
        where: placeOf(world, content, piece).where,
        why: cold ? 'it was cold' : 'the room was in use',
      },
    });
  }
  stop(p);
  return true;
}

/** Splitting: work at the store's log stack, then the firewood is theirs to carry onto its stack. */
function splitting(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const split = content.work.fire.split;
  const logs = logsOf(ctx, p);
  if (!logs) return stop(p);
  if (!same(spotOf(logs), spotOf(p))) return walkTo(ctx, p, spotOf(logs)) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  if ((p['work'] as number) > 0) return true;
  const n = Math.min(-(p['plan'] as number), logs['count'] as number);
  const item = fuelOf(content, split.fuel)?.item;
  if (n <= 0 || !item) return stop(p);
  takeFrom(world, logs, n);
  const id = layItem(world, {
    kind: item,
    count: n * split.per,
    ...spotOf(p),
    made: p['took'] as number,
  });
  itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  return stop(p);
}
