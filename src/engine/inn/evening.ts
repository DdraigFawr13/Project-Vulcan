// Evenings at the tavern (6B Bundle 5, P6.12, V-188). Once an evening, as each person's work ends,
// the inn's dice say whether they go: `evening.go` per cent plus their traits' (sociable more,
// solitary less); the innkeeper always goes, and on a winter evening everyone at leisure does, in
// place of the gathering by a lit hearth (people evening.ts). Those going walk in after work and stay at leisure,
// relaxing, until bed (people mind.ts calls `atTheInn`). Each hour the innkeeper, when there,
// pours a cup from a ready cask to each who has had fewer than `evening.cups` (`lowCups` for
// someone in a low mood): a cup is the `evening.cup` memory. With no ale or no innkeeper they
// leave after `evening.leave` minutes. Nobody is sent: there is no lever but the Work sheet.
import { clockAt, today, type EntityRow, type WorldState } from '../core/index.ts';
import { spotOf, walkTo } from '../band/index.ts';
import { roomAt, tavernHouse, rectOf, furnitureOf } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import { isDark } from '../lamp/index.ts';
import { hoursOf, isWinter } from '../law/index.ts';
import { addMemory, moodOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { inTavern, keeperOf, nightOf, readyKeg, tavernOf } from './tables.ts';

/** Minutes between looks for a place in the tavern, spread across people by id. */
const LOOK = 10;

const traitsOf = (ctx: SystemContext, p: EntityRow): string[] =>
  (ctx.world.entities['trait'] ?? [])
    .filter((t) => t['person'] === p.id)
    .map((t) => t['trait'] as string);

/** Each hour: everyone whose work has ended and who has not yet chosen tonight chooses. */
export function chooseEvenings(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (!tavernOf(world)) return;
  const hour = clockAt(world.tick, content.calendar).hour;
  const day = today(world);
  const keeper = keeperOf(world);
  const ev = content.tavern.evening;
  for (const p of world.entities['person'] ?? []) {
    if (p['status'] !== 'alive' || !grown(world, content, p)) continue;
    const row = nightOf(world, p.id);
    if (row?.['day'] === day || hour < hoursOf(world, content, p.id).workTo) continue;
    const odds = traitsOf(ctx, p).reduce((n, t) => n + (ev.traits[t] ?? 0), ev.go);
    const go = p.id === keeper || ctx.rng().int(100) < odds ? 1 : 0;
    const fresh = { day, go, came: 0, going: 0, cups: 0, leave: 0, brawled: 0, hung: 0 };
    if (row) Object.assign(row, fresh);
    else addEntity(world, 'night', { person: p.id, ...fresh, line: 0 });
  }
}

/** A free tile inside the tavern for `p`: a chair first, else bare floor, nearest first. */
function placeFor(ctx: SystemContext, p: EntityRow): { x: number; y: number; z: number }[] {
  const { world, content } = ctx;
  const h = tavernHouse(world);
  if (!h) return [];
  const r = rectOf(h);
  const room = roomAt(world, content, r.x + 1, r.y + 1);
  if (!room) return [];
  const width = world.map.width;
  const pieces = new Map(
    furnitureOf(world)
      .filter((f) => f['z'] === 0)
      .map((f) => [(f['y'] as number) * width + (f['x'] as number), f['kind'] as string]),
  );
  const taken = new Set(
    (world.entities['person'] ?? [])
      .filter((q) => q.id !== p.id && q['status'] === 'alive' && q['z'] === 0)
      .map((q) => (q['y'] as number) * width + (q['x'] as number)),
  );
  const from = spotOf(p);
  const far = (i: number) =>
    Math.max(Math.abs((i % width) - from.x), Math.abs(Math.floor(i / width) - from.y));
  return room.tiles
    .filter((i) => !taken.has(i) && (!pieces.has(i) || pieces.get(i) === 'chair'))
    .sort((a, b) => +(pieces.get(b) === 'chair') - +(pieces.get(a) === 'chair') || far(a) - far(b))
    .map((i) => ({ x: i % width, y: Math.floor(i / width), z: 0 }));
}

/** Tonight's row of `p` if they go to the tavern this minute and have not left it. */
function goingTonight(ctx: SystemContext, p: EntityRow, evening: boolean): EntityRow | undefined {
  const { world } = ctx;
  const row = nightOf(world, p.id);
  if (!evening || !row || row['day'] !== today(world) || !tavernOf(world)) return undefined;
  // On a winter evening the tavern's fire takes the place of the gathering by a hearth (V-162).
  const winter = isWinter(world, ctx.content) && isDark(ctx.content, world.tick);
  if (!row['go'] && !winter) return undefined;
  if (row['leave'] && world.tick >= (row['leave'] as number)) {
    row['going'] = 0;
    return undefined;
  }
  return row;
}

/** Sets `p` walking to a free place in the tavern. */
function setOff(ctx: SystemContext, p: EntityRow, row: EntityRow): boolean {
  for (const spot of placeFor(ctx, p).slice(0, 4))
    if (walkTo(ctx, p, spot)) {
      row['going'] = 1;
      p['doing'] = 'relax';
      return true;
    }
  return false;
}

/** One minute of an evening's free time (`evening`: after work); true while `p` is at the tavern or
 * on the way there. */
export function atTheInn(ctx: SystemContext, p: EntityRow, evening: boolean): boolean {
  const { world } = ctx;
  const row = goingTonight(ctx, p, evening);
  if (!row) return false;
  const walking = (p['path'] as number[]).length > 0;
  if (inTavern(world, p) && !walking) {
    if (!row['came']) row['came'] = world.tick;
    row['going'] = 0;
    p['doing'] = 'relax';
    return true;
  }
  if (!inTavern(world, p) && row['came']) return false;
  if (row['going'] && walking) {
    p['doing'] = 'relax';
    return true;
  }
  if ((world.tick + p.id) % LOOK !== 0 && !row['going']) return false;
  return setOff(ctx, p, row);
}

/** The most cups `p` drinks tonight: more for someone in a low mood. */
function most(ctx: SystemContext, p: EntityRow): number {
  const ev = ctx.content.tavern.evening;
  const mood = (moodOf(ctx.world, p.id)?.['value'] as number | undefined) ?? ev.low;
  return mood < ev.low ? ev.lowCups : ev.cups;
}

/** Those inside the tavern now, by id. */
export const drinkersIn = (ctx: SystemContext): EntityRow[] =>
  (ctx.world.entities['person'] ?? []).filter(
    (p) => p['status'] === 'alive' && p['doing'] !== 'sleep' && inTavern(ctx.world, p),
  );

/** Whether `row`'s drinker is here tonight to be served: come, not the keeper, not yet gone. */
const served = (world: WorldState, row: EntityRow | undefined, keeper: boolean): row is EntityRow =>
  !!row &&
  row['day'] === today(world) &&
  !!row['came'] &&
  !keeper &&
  !((row['leave'] as number) && (row['leave'] as number) <= world.tick);

/** No cup to pour: wait for a keeper on the way to a ready cask, else leave after a while. */
function dry(ctx: SystemContext, row: EntityRow, onTheWay: boolean): void {
  if (row['leave'] || (onTheWay && readyKeg(ctx.world))) return;
  row['leave'] = ctx.world.tick + ctx.content.tavern.evening.leave;
}

/** Each hour: the innkeeper pours a cup to each who wants one; with nothing poured, they leave
 * after `evening.leave` minutes. Returns who drank a cup, for the brawls. */
export function pour(ctx: SystemContext): EntityRow[] {
  const { world, content } = ctx;
  const t = tavernOf(world);
  if (!t) return [];
  const here = drinkersIn(ctx);
  const keeper = here.find((q) => q.id === t['keeper']);
  // The keeper still on the road: those who came wait for them.
  const kept = nightOf(world, t['keeper'] as number);
  const onTheWay = !keeper && !!kept && kept['day'] === today(world) && !!kept['go'];
  const drank: EntityRow[] = [];
  for (const p of here) {
    const row = nightOf(world, p.id);
    if (!served(world, row, p.id === t['keeper'])) continue;
    const keg = keeper && readyKeg(world);
    if (!keg) {
      dry(ctx, row, onTheWay);
      continue;
    }
    if ((row['cups'] as number) >= most(ctx, p)) continue;
    keg['cups'] = (keg['cups'] as number) - 1;
    Object.assign(row, { cups: (row['cups'] as number) + 1, leave: 0, line: keg['line'] });
    addMemory(ctx, p.id, content.tavern.evening.cup, keg['line'] as number, keeper.id);
    drank.push(p);
  }
  return drank;
}
