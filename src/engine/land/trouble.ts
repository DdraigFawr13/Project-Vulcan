// What can befall a trip (6W Slice 5, V-206): a fall on loose stone, rock or snow, and losing the
// way in wet or hard weather on land nobody knows. The cold (the chill) and a hungry pack at a
// lone camp come from the needs, health and wild systems as they would for anyone. Rolls draw
// from the `trips` stream, each quarter hour.
import { TICKS_PER_DAY, streamFor, type EntityRow } from '../core/index.ts';
import { wound } from '../health/index.ts';
import { walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { walkTo } from '../band/index.ts';
import { awayFrom } from './camp.ts';

/** Each quarter hour walking far from home on a trip (a quarter of the hour's odds): a fall on
 * rough ground, or losing the way. */
export function trouble(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  if (world.tick % 15 !== 0 || !(p['path'] as number[]).length || p['z'] !== 0) return;
  const def = content.work.scout;
  if (awayFrom(ctx, p).far <= def.reach) return;
  const map = world.map;
  const i = (p['y'] as number) * map.width + (p['x'] as number);
  const kind = content.terrain.kinds[map.tiles[i]!]!.id;
  const rough = def.fall.ground.includes(kind) || map.snowLie[i]! > 0;
  if (rough && streamFor(world, 'trips').int(4 * def.fall.per) < def.fall.perHour)
    return fall(ctx, p, kind, i);
  loseWay(ctx, p, i);
}

/** On land nobody knows, in wet or hard weather: they may lose the way, once a trip. */
function loseWay(ctx: SystemContext, p: EntityRow, i: number): void {
  const { world, content } = ctx;
  const def = content.work.scout;
  const weather = content.weather[world.systems['weather']?.['kind'] ?? 0]?.id ?? '';
  const trip = world.map.finds.at(-1);
  if (!trip || trip.count !== -1 || trip.strayed || world.map.known[i] === 1) return;
  if (!def.lost.weather.includes(weather)) return;
  if (streamFor(world, 'trips').int(4 * def.lost.per) >= def.lost.perHour) return;
  trip.strayed = 1;
  const { far, dir } = awayFrom(ctx, p);
  ctx.emit('land.lostWay', {
    causes: [p['took'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, weather: def.lost.words[weather] ?? weather, far, dir },
  });
  // They wander round where they lost it (`target`, the tile), and the trip's days run on.
  const days = def.lost.days * TICKS_PER_DAY;
  Object.assign(p, {
    astray: world.tick + days,
    work: (p['work'] as number) + days,
    path: [],
    target: i,
  });
}

/** A fall: a wound by the accident shares (a grave one may be mortal), citing the setting-out. */
function fall(ctx: SystemContext, p: EntityRow, kind: string, i: number): void {
  const { world, content } = ctx;
  const def = content.work.scout.fall;
  const rng = streamFor(world, 'trips');
  const sevs = content.health.severities;
  const severity = rng.weighted(sevs.map((s) => [s.id, s.share] as const));
  const sev = sevs.find((s) => s.id === severity)!;
  const mortal = !!sev.mortal && rng.int(100) < sev.mortal;
  const where =
    world.map.snowLie[i]! > 0 ? 'snow' : content.terrain.kinds.find((k) => k.id === kind)!.name;
  const took = p['took'] as number;
  const [job, what, work] = [p['job'], p['what'], p['work']];
  const w = wound(
    ctx,
    p,
    { part: rng.pick(def.parts), kind: def.wound, severity, what: def.what, where, place: 'on' },
    [took],
    mortal,
  );
  // Alone and off their feet, they bind a slow-bleeding wound as best they can, and wait.
  if (p['doing'] === 'hurt' && w['bleed'] === 1 && !mortal)
    Object.assign(w, { bound: 1, bleed: 0 });
  // Still on their feet, they limp on home: the trip is theirs still.
  if (p['doing'] !== 'hurt') Object.assign(p, { job, task: 'home', what, work, took });
}

/** Lost: they wander within `lost.wander` tiles of where they lost the way until the days are
 * out; true while they do. */
export function astray(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (world.tick >= (p['astray'] as number)) return false;
  if ((p['path'] as number[]).length) return true;
  const rng = streamFor(world, 'trips');
  const r = content.work.scout.lost.wander;
  const map = world.map;
  const at = p['target'] as number;
  const [ax, ay] =
    at >= 0 ? [at % map.width, Math.floor(at / map.width)] : [p['x'] as number, p['y'] as number];
  for (let k = 0; k < 8; k += 1) {
    const x = ax + rng.int(2 * r + 1) - r;
    const y = ay + rng.int(2 * r + 1) - r;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (walkAt(content, map, 0, y * map.width + x) && walkTo(ctx, p, { x, y, z: 0 })) return true;
  }
  return true;
}
