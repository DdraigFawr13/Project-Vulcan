// Farming (P4.7, V-015, V-089): nobody is told to sow or reap. A free person takes up reaping a
// ripe field, else sowing a field that waits for seed in a month its crop is sown in, when seed
// can be reached: they fetch seed from the store (one a tile), then work tile by tile from beside
// each, shorter with farming skill. A reaped tile's yield lies on it for haulers, seed first
// until the colony's seed reaches its plate's want. The field's state and lines are build
// fieldlife.ts; this is the people's side, the same shape as foraging.
import { clockAt, type EngineContent, type EntityRow } from '../core/index.ts';
import {
  cropOf,
  fieldDone,
  fieldPlace,
  fieldsOf,
  fieldTiles,
  finishReaping,
  finishSowing,
  courseNow,
  sowNow,
  tileYield,
} from '../build/index.ts';
import { haveOf, isTree, itemsOf, layItem, takeFrom, wantOf } from '../goods/index.ts';
import { reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stackOf } from './build.ts';
import { practise } from './learn.ts';
import { canMuck, mucking } from './muck.ts';
import { scaled, worked } from './tools.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { besideReachable, busy, goBeside, layAround, same, skillOf, spotOf } from './spots.ts';
import { canWater, watering } from './water-fields.ts';
import { walkTo } from './walk.ts';

const monthOf = (ctx: SystemContext): string =>
  ctx.content.calendar.monthNames[clockAt(ctx.world.tick, ctx.content.calendar).month] ?? '';

interface Task {
  field: EntityRow;
  mode: 'sow' | 'reap' | 'muck' | 'water';
}

const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.work.farm.job)?.skill ?? '';

/** The tile `p` would work next on field `f`: the nearest not yet done, nobody else's, with no
 * tree left on it to sow, that they can get beside. */
function nextTile(ctx: SystemContext, p: EntityRow, f: EntityRow, mode: Task['mode']) {
  const { world, content } = ctx;
  const map = world.map;
  const done = new Set(fieldDone(f));
  const taken = busy(world, p, 'farm');
  const here = spotOf(p);
  const far = (i: number) =>
    Math.max(Math.abs((i % map.width) - here.x), Math.abs(Math.floor(i / map.width) - here.y));
  const open = fieldTiles(f)
    .filter((i) => !done.has(i) && !taken.has(i) && (mode === 'reap' || !isTree(world, content, i)))
    .sort((a, b) => far(a) - far(b) || a - b);
  const from = reachFrom(content, map, here);
  return open.find((i) => besideReachable(world, content, from, i));
}

/** What `p` would take up: reaping a ripe field before sowing one. */
function taskFor(ctx: SystemContext, p: EntityRow): (Task & { tile: number }) | undefined {
  const { world, content } = ctx;
  const fields = fieldsOf(world).filter((f) => f['state'] !== 'sent');
  for (const f of fields.filter((r) => r['state'] === 'ripe')) {
    const tile = nextTile(ctx, p, f, 'reap');
    if (tile !== undefined) return { field: f, mode: 'reap', tile };
  }
  if (stackOf(ctx, p, content.buildings.field.seed))
    for (const f of fields.filter((r) => r['state'] === 'plan' || r['state'] === 'fallow')) {
      if (!sowNow(world, content, f)) continue;
      const tile = nextTile(ctx, p, f, 'sow');
      if (tile !== undefined) return { field: f, mode: 'sow', tile };
    }
  // A dry spell's parched rows are watered before muck is carried.
  const parched = fields.find((f) => f['state'] === 'sown' && canWater(ctx, p, f));
  if (parched) return { field: parched, mode: 'water', tile: -1 };
  // Muck after the sowing: the poorest fallow field first is the first that has ground for it.
  const bare = fields.find((f) => canMuck(ctx, p, f));
  return bare ? { field: bare, mode: 'muck', tile: -1 } : undefined;
}

/** Takes up reaping or sowing, if there is a field for it and nobody who puts it higher could. */
export function takeUpFarming(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const job = content.work.farm.job;
  if (!fieldsOf(world).length || !able(content, p, job)) return false;
  if (outranked(ctx, p, job, (q) => taskFor(ctx, q) !== undefined)) return false;
  const task = taskFor(ctx, p);
  if (!task) return false;
  const { field: f, mode } = task;
  const crop =
    mode === 'reap' || mode === 'water'
      ? cropOf(content, f['crop'] as string)
      : mode === 'sow'
        ? sowNow(world, content, f)
        : undefined;
  const line = {
    ...{ reap: 'work.tookUpReaping', sow: 'work.tookUpSowing', muck: 'work.tookUpMucking' },
    water: 'work.tookUpWatering',
  };
  p['took'] = ctx.emit(line[mode], {
    causes: [
      ...[f['last'] as number, priorityLine(world, p.id, job)].filter(
        (l): l is number => l !== undefined && l > 0,
      ),
    ],
    actors: [p.id],
    data: { name: p['name'] as string, crop: crop?.name ?? '', ...fieldPlace(world, f) },
  });
  p['job'] = 'farm';
  p['task'] = mode === 'muck' || mode === 'water' ? mode : '';
  p['plan'] = f.id;
  p['target'] = -1;
  p['pail'] = 0;
  return farming(ctx, p);
}

/** Stops farming: the field is done, changed or out of reach. */
function stop(p: EntityRow): false {
  p['job'] = '';
  p['task'] = '';
  p['plan'] = 0;
  p['target'] = -1;
  p['pail'] = 0;
  return false;
}

const minutesFor = (content: EngineContent, minutes: number, level: number): number =>
  Math.max(
    1,
    Math.ceil((minutes * 2 * content.work.farm.skilled) / (content.work.farm.skilled + level)),
  );

/** Goes to the nearest seed in reach and takes up to a load of it (not more than the field needs). */
function fetchSeed(ctx: SystemContext, p: EntityRow, f: EntityRow): boolean {
  const { world, content } = ctx;
  const item = stackOf(ctx, p, content.buildings.field.seed);
  if (!item) return stop(p);
  if (!same(spotOf(item), spotOf(p))) return walkTo(ctx, p, spotOf(item)) || stop(p);
  const unsown = fieldTiles(f).length - fieldDone(f).length;
  const count = Math.min(unsown, content.work.haul.load, item['count'] as number);
  if (count === (item['count'] as number)) item['holder'] = p.id;
  else {
    takeFrom(world, item, count);
    const id = layItem(world, {
      kind: content.buildings.field.seed,
      count,
      ...spotOf(p),
      made: item['made'] as number,
    });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  return true;
}

/** One minute on the field they took up; false when it is done, changed or out of reach (they
 * look for work again, and any seed they carry goes back to the store). */
export function farming(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const f = fieldsOf(world).find((r) => r.id === p['plan']);
  if (p['task'] === 'muck') return (f && mucking(ctx, p, f)) || stop(p);
  if (p['task'] === 'water') return (f && watering(ctx, p, f)) || stop(p);
  const state = f?.['state'];
  const mode: Task['mode'] | undefined =
    state === 'ripe'
      ? 'reap'
      : f && (state === 'plan' || state === 'fallow') && sowNow(world, content, f)
        ? 'sow'
        : undefined;
  if (!f || !mode) return stop(p);
  const held = itemsOf(world).find(
    (i) => i['holder'] === p.id && i['kind'] === content.buildings.field.seed,
  );
  if (mode === 'sow' && !held) return fetchSeed(ctx, p, f);
  let tile = p['target'] as number;
  const bad =
    tile < 0 || fieldDone(f).includes(tile) || (mode === 'sow' && isTree(world, content, tile));
  if (bad) {
    const next = nextTile(ctx, p, f, mode);
    if (next === undefined) return stop(p);
    const level = skillOf(world, p, skillName(content));
    p['target'] = tile = next;
    const minutes = minutesFor(content, content.work.farm[mode === 'sow' ? 'sow' : 'reap'], level);
    p['work'] = scaled(ctx, p, 'farm', minutes);
  }
  const [x, y] = [tile % map.width, Math.floor(tile / map.width)];
  const here = spotOf(p);
  if (here.z !== 0 || Math.abs(here.x - x) + Math.abs(here.y - y) !== 1)
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  worked(ctx, p, 'farm');
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  p['target'] = -1;
  if (mode === 'sow') sowTile(ctx, p, f, tile, held!);
  else reapTile(ctx, p, f, tile);
  return true;
}

/** One seed goes into the tile; the last tile sown starts the crop growing. */
function sowTile(ctx: SystemContext, p: EntityRow, f: EntityRow, tile: number, seed: EntityRow) {
  const crop = sowNow(ctx.world, ctx.content, f)!;
  takeFrom(ctx.world, seed, 1);
  // The first tile sown takes the course: the next sowing is the one after it.
  if (!f['crop']) {
    const pick = courseNow(ctx.content, f, monthOf(ctx));
    if (pick) f['course'] = (pick.at + 1) % ctx.content.buildings.field.rotation.length;
  }
  f['crop'] = crop.id;
  fieldDone(f).push(tile);
  f['took'] = p['took'] as number;
  if (fieldDone(f).length >= fieldTiles(f).length) {
    finishSowing(ctx, f, p['took'] as number);
    stop(p);
  }
}

/** The tile is reaped: its yield lies on it for haulers, seed first until the colony has what its
 * Seed plate wants. The last tile reaped brings the harvest in. */
function reapTile(ctx: SystemContext, p: EntityRow, f: EntityRow, tile: number): void {
  const { world, content } = ctx;
  const crop = cropOf(content, f['crop'] as string)!;
  const at = { x: tile % world.map.width, y: Math.floor(tile / world.map.width), z: 0 };
  const short = Math.max(
    0,
    wantOf(world, content, content.buildings.field.seed) -
      haveOf(world, content, content.buildings.field.seed),
  );
  const yielded = tileYield(world, content, f, crop.yield, tile);
  const seed = Math.min(yielded, short);
  const made = p['took'] as number;
  const kept = seed ? layAround(ctx, content.buildings.field.seed, seed, at, made) : 0;
  const got = layAround(ctx, crop.item, yielded - seed, at, made);
  f['kept'] = (f['kept'] as number) + kept;
  f['got'] = (f['got'] as number) + got;
  fieldDone(f).push(tile);
  f['took'] = made;
  const reapers = f['reapers'] as number[];
  if (!reapers.includes(p.id)) reapers.push(p.id);
  if (fieldDone(f).length >= fieldTiles(f).length) {
    finishReaping(ctx, f, made);
    stop(p);
  }
}
