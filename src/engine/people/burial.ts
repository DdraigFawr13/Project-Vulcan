// Burying the dead (P5.8, V-116), Building's work on the Work sheet. A free builder takes up the
// nearest body lying unburied once there is a burial ground (build/burial.ts) with a free plot:
// carries it there, digs the grave (`health.burial.minutes`, faster with a better tool) and
// sets a carved wooden marker if the store has a log for it. The grave is filled at day's end
// with everyone free there (health). Taking it up is one line; the digging is not.
import type { EntityRow } from '../core/index.ts';
import { burialGround, freePlots, gravesOf } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { inStore, itemsOf, takeFrom } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able } from './priority.ts';
import { people, same, spotOf } from './spots.ts';
import { scaled, worked } from './tools.ts';
import { walkTo } from './walk.ts';

const bodyRow = (ctx: SystemContext, person: number): EntityRow | undefined =>
  (ctx.world.entities['body'] ?? []).find((b) => b['person'] === person);

/** The plot `p` digs, from its tile index plus one in `plan`. */
const plotOf = (ctx: SystemContext, p: EntityRow): Spot => {
  const i = (p['plan'] as number) - 1;
  const w = ctx.world.map.width;
  return { x: i % w, y: Math.floor(i / w), z: 0 };
};

/** Takes up burying the nearest unburied body, if a plot is free; false otherwise. */
export function takeUpBurial(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const ground = burialGround(world);
  if (!ground || !able(content, p, content.buildings.job)) return false;
  const width = world.map.width;
  const others = people(world).filter((q) => q.id !== p.id && q['job'] === 'bury');
  const reserved = new Set(others.map((q) => (q['plan'] as number) - 1));
  const plot = freePlots(world).find((s) => !reserved.has(s.y * width + s.x));
  if (!plot) return false;
  const taken = new Set([
    ...others.map((q) => q['target']),
    ...gravesOf(world).map((g) => g['person']),
  ]);
  const from = spotOf(p);
  const dead = people(world)
    .filter((d) => d['status'] === 'dead' && !taken.has(d.id))
    .filter((d) => canReach(content, world.map, from, spotOf(d)))
    .sort(
      (a, b) =>
        Math.max(Math.abs((a['x'] as number) - from.x), Math.abs((a['y'] as number) - from.y)) -
          Math.max(Math.abs((b['x'] as number) - from.x), Math.abs((b['y'] as number) - from.y)) ||
        a.id - b.id,
    )[0];
  if (!dead || !walkTo(ctx, p, spotOf(dead))) return false;
  const died = (bodyRow(ctx, dead.id)?.['died'] as number) || 0;
  p['took'] = ctx.emit('work.tookUpBurial', {
    causes: [died, ground['line'] as number].filter((l) => l > 0),
    actors: [p.id, dead.id],
    data: { name: p['name'] as string, dead: dead['name'] as string },
  });
  Object.assign(p, {
    job: 'bury',
    target: dead.id,
    task: 'carry',
    plan: plot.y * width + plot.x + 1,
  });
  return true;
}

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', target: -1, task: '', plan: 0, work: 0 });
  return false;
}

/** One minute of burying; false when it ended. */
export function burying(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const dead = people(world).find((d) => d.id === p['target']);
  const body = dead && bodyRow(ctx, dead.id);
  if (
    !dead ||
    !body ||
    dead['status'] !== 'dead' ||
    gravesOf(world).some((g) => g['person'] === dead.id)
  ) {
    if (body?.['carrier'] === p.id) body['carrier'] = 0;
    return stop(p);
  }
  const plot = plotOf(ctx, p);
  // The ground sent back under them: they set the body down and stop.
  if (!freePlots(world).some((s) => same(s, plot))) {
    if (body['carrier'] === p.id) body['carrier'] = 0;
    return stop(p);
  }
  if ((p['path'] as number[]).length) return true;
  const here = spotOf(p);
  if (p['task'] === 'carry') {
    if (body['carrier'] !== p.id) {
      if (!same(here, spotOf(dead))) return walkTo(ctx, p, spotOf(dead)) || stop(p);
      body['carrier'] = p.id;
    }
    if (!same(here, plot)) {
      if (walkTo(ctx, p, plot)) return true;
      body['carrier'] = 0;
      return stop(p);
    }
    body['carrier'] = 0;
    Object.assign(dead, plot);
    p['task'] = 'dig';
    p['work'] = scaled(ctx, p, content.health.burial.job, content.health.burial.minutes);
    return true;
  }
  if (!same(here, plot)) return walkTo(ctx, p, plot) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  worked(ctx, p, content.health.burial.job);
  if ((p['work'] as number) > 0) return true;
  const log = itemsOf(world).find(
    (i) =>
      i['kind'] === content.health.burial.marker &&
      !i['holder'] &&
      inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
  );
  if (log) takeFrom(world, log, 1);
  addEntity(world, 'grave', {
    ...{ person: dead.id, x: plot.x, y: plot.y, by: p.id, line: p['took'] as number },
    ...{ marker: log ? 1 : 0, state: 'dug', buried: 0 },
  });
  stop(p);
  return true;
}
