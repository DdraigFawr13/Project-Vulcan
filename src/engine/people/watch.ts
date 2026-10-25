// The watch fire (Phase 5A Bundle 6, V-041): nobody is told to sit up. On the nights after a sign
// of the pack (it came to the town's edge, the midden or a fold, or someone found its fresh
// tracks), within `flock.watch.nights` nights, the herder who puts Herding highest and is fit
// lights a fire beside the fold and sits up by it until first light. The fire burns
// `watch.firewood` pieces from the store; with too few there is no watch, and a line says so. The
// pack keeps `watch.reach` tiles from a lit watch fire (wild `setWards`); the watcher sleeps until
// `watch.wake` o'clock. The fire is a hearth piece laid at the first watch and kept for the next.
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { flocksOf, headOf, pastureOf } from '../flock/index.ts';
import { createFire, fireOf } from '../fire/index.ts';
import { inStore, itemsOf, takeFrom } from '../goods/index.ts';
import { findEvent } from '../log/index.ts';
import { isDown } from '../health/index.ts';
import { walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { packOf, setWards } from '../wild/index.ts';
import { able, levelOf } from './priority.ts';
import { goBeside, people, spotOf } from './spots.ts';

const at = (world: WorldState, i: number) => ({
  x: i % world.map.width,
  y: Math.floor(i / world.map.width),
});

const minuteOfDay = (ctx: SystemContext): number => ctx.world.tick % TICKS_PER_DAY;

/** The minute of the day a watch begins: folding time (`fold.before` minutes before dusk). */
const startMinute = (ctx: SystemContext): number =>
  ctx.content.wild.pack.night.from * 60 - ctx.content.flock.fold.before;

/** From the watch's start to first light: the hours a watch is kept. */
function watchHours(ctx: SystemContext): boolean {
  const now = minuteOfDay(ctx);
  return now >= startMinute(ctx) || now < ctx.content.wild.pack.night.to * 60;
}

/** Each minute (herd.ts `herdWatch`): notes a sign of the pack, starts tonight's watches, ends
 * them at first light and keeps the wild side's wards to the lit fires. */
export function watchMinute(ctx: SystemContext): void {
  noteSign(ctx);
  const { world, content } = ctx;
  const now = minuteOfDay(ctx);
  if (now === content.wild.pack.night.to * 60)
    for (const f of flocksOf(world)) if (f['watchBy']) endWatch(ctx, f);
  // Tonight's watches are weighed once, at the first minute of watch hours the sim runs.
  const night = Math.floor(world.tick / TICKS_PER_DAY) - (now < startMinute(ctx) ? 1 : 0);
  if (watchHours(ctx) && ctx.state['watchNight'] !== night) {
    ctx.state['watchNight'] = night;
    for (const f of flocksOf(world)) startWatch(ctx, f);
  }
}

/** The pack's latest visit with a line (at the edge, the midden or a fold, or turned by a fire),
 * or fresh tracks found: the tick and the line, kept in the people system's state. */
function noteSign(ctx: SystemContext): void {
  const { world, state } = ctx;
  const pack = packOf(world);
  if (pack?.['shown'] && pack['visitAt'] !== state['signVisit']) {
    Object.assign(state, {
      signVisit: pack['visitAt'] as number,
      signAt: world.tick,
      signLine: pack['line'] as number,
    });
  }
  const tracks = state['tracksLine'] ?? 0;
  if (tracks && tracks !== state['signTracks'])
    Object.assign(state, { signTracks: tracks, signAt: world.tick, signLine: tracks });
}

/** Who keeps watch: the herder who puts Herding highest, alive, not hurt or down. */
function watcherFor(ctx: SystemContext): EntityRow | undefined {
  const { world, content } = ctx;
  const job = content.flock.job;
  return people(world)
    .filter(
      (q) =>
        q['status'] === 'alive' &&
        able(content, q, job) &&
        q['doing'] !== 'hurt' &&
        !isDown(world, q.id) &&
        !flocksOf(world).some((f) => f['watchBy'] === q.id),
    )
    .sort((a, b) => levelOf(world, content, a.id, job) - levelOf(world, content, b.id, job))[0];
}

/** Firewood stacks in the store, fullest first. */
const firewoodIn = (world: WorldState, item: string): EntityRow[] =>
  itemsOf(world)
    .filter(
      (i) =>
        i['kind'] === item &&
        !i['holder'] &&
        inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
    )
    .sort((a, b) => (b['count'] as number) - (a['count'] as number) || a.id - b.id);

/** At folding time on a night within `watch.nights` of a sign: a watcher for `flock`, or one
 * line why there is none. */
function startWatch(ctx: SystemContext, flock: EntityRow): void {
  const { world, content, state } = ctx;
  const w = content.flock.watch;
  const sign = state['signAt'] ?? 0;
  if (!sign || world.tick - sign > w.nights * TICKS_PER_DAY || !headOf(world, flock)) return;
  const fuel = content.work.fire.fuels[0]!;
  const have = firewoodIn(world, fuel.item).reduce((n, i) => n + (i['count'] as number), 0);
  const who = watcherFor(ctx);
  const why = !who
    ? (content.flock.watchWhy['nobody'] ?? '')
    : have < w.firewood
      ? (content.flock.watchWhy['firewood'] ?? '')
          .replace('{have}', String(have))
          .replace('{need}', String(w.firewood))
      : '';
  const sign0 = (state['signLine'] as number) || (flock['line'] as number);
  if (why) {
    flock['line'] = ctx.emit('flock.noWatch', {
      causes: [sign0].filter((c) => c > 0),
      data: { why },
    });
    return;
  }
  let left = w.firewood;
  for (const stack of firewoodIn(world, fuel.item))
    if (left > 0) left -= takeFrom(world, stack, left);
  Object.assign(flock, { watchBy: who!.id, watch: 0 });
  Object.assign(who!, { job: '', task: '', plan: 0, target: -1, work: 0, path: [] });
  who!['doing'] = 'watch';
  state[`watchFrom_${who!.id}`] = sign0;
}

/** The tile the watch fire burns on: the piece laid before, else an open tile outside the pasture
 * nearest its rick (beside the fold). */
function fireTile(ctx: SystemContext, flock: EntityRow): number | undefined {
  const { world, content } = ctx;
  const piece = (world.entities['furniture'] ?? []).find((f) => f.id === flock['watchPiece']);
  const w = world.map.width;
  if (piece) return (piece['y'] as number) * w + (piece['x'] as number);
  const p = pastureOf(world, flock);
  const rick = at(world, p['rick'] as number);
  const [x0, y0] = [p['x'] as number, p['y'] as number];
  const inside = (x: number, y: number) =>
    x >= x0 && y >= y0 && x < x0 + (p['w'] as number) && y < y0 + (p['h'] as number);
  const taken = new Set(
    [...itemsOf(world), ...(world.entities['furniture'] ?? [])].map(
      (r) => (r['y'] as number) * w + (r['x'] as number),
    ),
  );
  for (let r = 1; r <= 4; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        const [x, y] = [rick.x + dx, rick.y + dy];
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || inside(x, y)) continue;
        if (x < 0 || y < 0 || x >= w || y >= world.map.height) continue;
        const i = y * w + x;
        if (world.map.built[i] || taken.has(i) || walkAt(content, world.map, 0, i) <= 0) continue;
        return i;
      }
  return undefined;
}

/** One minute of the watcher's night (mind.ts): to the fire, lay and light it, then sit up. True
 * while `p` keeps a watch. */
export function watching(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content, state } = ctx;
  const flock = flocksOf(world).find((f) => f['watchBy'] === p.id);
  if (!flock) return false;
  if (!watchHours(ctx)) {
    endWatch(ctx, flock);
    return false;
  }
  // Before dusk the flock is shut in first, by the herding work (herd.ts), then the fire.
  const dusk = ctx.content.wild.pack.night.from * 60;
  if (!flock['folded'] && headOf(world, flock) && minuteOfDay(ctx) < dusk && !flock['watch'])
    return false;
  p['doing'] = 'watch';
  if ((p['path'] as number[]).length) return true;
  const tile = fireTile(ctx, flock);
  if (tile === undefined) return quit(flock, p);
  const spot = at(world, tile);
  const here = spotOf(p);
  if (Math.max(Math.abs(here.x - spot.x), Math.abs(here.y - spot.y)) > 1 || here.z !== 0)
    return goBeside(ctx, p, spot.x, spot.y) || quit(flock, p);
  if (flock['watch']) return true;
  p['work'] = (p['work'] as number) + 1;
  if ((p['work'] as number) < content.flock.watch.light) return true;
  p['work'] = 0;
  light(ctx, flock, p, tile, state[`watchFrom_${p.id}`] ?? 0);
  return true;
}

/** No way to the fire's tile: the watch is off for tonight. */
function quit(flock: EntityRow, p: EntityRow): false {
  Object.assign(flock, { watchBy: 0, watch: 0 });
  p['doing'] = '';
  return false;
}

/** Lays the hearth piece the first time, lights its fire for the night and sets the ward. */
function light(ctx: SystemContext, flock: EntityRow, p: EntityRow, tile: number, cause: number) {
  const { world, content } = ctx;
  const spot = at(world, tile);
  const fuel = content.work.fire.fuels[0]!;
  let piece = (world.entities['furniture'] ?? []).find((f) => f.id === flock['watchPiece']);
  if (!piece) {
    const id = addEntity(world, 'furniture', {
      ...{ kind: 'hearth', x: spot.x, y: spot.y, z: 0, facing: '', quality: 0, maker: p.id },
      ...{ owner: 0, made: 0, line: 0, state: 'built', have: 0, work: 0, waited: 0 },
    });
    piece = (world.entities['furniture'] ?? []).find((f) => f.id === id)!;
    flock['watchPiece'] = id;
    createFire(ctx, piece, cause);
  }
  const line = ctx.emit('flock.watchLit', {
    causes: [cause].filter((c) => c > 0),
    actors: [p.id],
    data: { name: p['name'] as string, why: signWords(ctx, cause) },
  });
  const fire = fireOf(world, piece.id)!;
  // Kept small, the night's `watch.firewood` pieces last until first light.
  const dawn = content.wild.pack.night.to * 60;
  const now = minuteOfDay(ctx);
  Object.assign(fire, {
    lit: 1,
    banked: 0,
    kind: fuel.id,
    fuel: (now < dawn ? dawn - now : TICKS_PER_DAY - now + dawn) + 60,
    used: world.tick,
    line,
  });
  Object.assign(flock, { watch: line, line });
  syncWards(ctx);
}

/** The sign in words, from the line's type. */
function signWords(ctx: SystemContext, cause: number): string {
  const type = findEvent(ctx.world.log, cause)?.type ?? '';
  const words = ctx.content.flock.watchWhy;
  return words[type] ?? words['default'] ?? '';
}

/** First light (or the watcher gone): the fire is let die, the ward goes, and the watcher goes to
 * bed until `watch.wake` o'clock. */
function endWatch(ctx: SystemContext, flock: EntityRow): void {
  const { world, content, state } = ctx;
  const p = people(world).find((q) => q.id === flock['watchBy']);
  const piece = flock['watchPiece'] as number;
  const fire = piece ? fireOf(world, piece) : undefined;
  if (fire) Object.assign(fire, { lit: 0, fuel: 0, banked: 0 });
  const lit = flock['watch'] as number;
  Object.assign(flock, { watchBy: 0, watch: 0 });
  syncWards(ctx);
  if (!p || p['status'] !== 'alive') return;
  delete state[`watchFrom_${p.id}`];
  if (p['doing'] === 'watch') p['doing'] = '';
  if (!lit) return;
  const wake = content.flock.watch.wake;
  const day = world.tick - (world.tick % TICKS_PER_DAY);
  state[`late_${p.id}`] = day + wake * 60;
  flock['line'] = ctx.emit('flock.watchEnded', {
    causes: [lit],
    actors: [p.id],
    data: { name: p['name'] as string, wake: `${String(wake).padStart(2, '0')}:00` },
  });
}

/** The tick until which `p` sleeps late after a watch (0 for none). */
export const lateUntil = (ctx: SystemContext, p: EntityRow): number =>
  ctx.state[`late_${p.id}`] ?? 0;

/** The wild side's wards: one per lit watch fire. */
function syncWards(ctx: SystemContext): void {
  const { world, content } = ctx;
  setWards(
    ctx,
    flocksOf(world)
      .filter((f) => f['watch'] && f['watchPiece'])
      .map((f) => {
        const piece = (world.entities['furniture'] ?? []).find((r) => r.id === f['watchPiece'])!;
        return {
          tile: (piece['y'] as number) * world.map.width + (piece['x'] as number),
          reach: content.flock.watch.reach,
          line: f['watch'] as number,
        };
      }),
  );
}

/** A watch fire's hearth piece, which nobody else tends or lights (tend.ts). */
export const isWatchFire = (world: WorldState, piece: EntityRow): boolean =>
  flocksOf(world).some((f) => f['watchPiece'] === piece.id);
