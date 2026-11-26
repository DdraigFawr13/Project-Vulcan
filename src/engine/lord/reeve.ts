// The reeve (6C Slice 1, V-216): the lord's man walks in by the home road the morning after every
// harvest home, finds the elder (else whoever is nearest the hall), says his piece and goes home
// before dark. The first time he names the lord and the share owed from the next harvest home;
// after that he counts the store and, until Slice 2's tithe, takes nothing. Nobody sends for him
// and no lever moves him (V-041).
import { TICKS_PER_DAY, TICKS_PER_HOUR, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, alive, removeEntity } from '../entity/index.ts';
import { edgeSpot, stepAlong, walkTo } from '../band/index.ts';
import { greenOf, hallOf, rectOf } from '../build/index.ts';
import { elderOf } from '../colony/index.ts';
import { foodDays } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lordName, lordRow, reeveRow } from './tables.ts';
import { markForest } from './forest.ts';
import { swear, takeTithe } from './tithe.ts';
import { askAtVisit } from './asks.ts';
import { climb } from './favour.ts';
import { plead } from './petition.ts';
import { rideOut, stayMinute } from './visit.ts';

const hourOf = (tick: number) => Math.floor((tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
const spot = (r: EntityRow): Spot => ({
  x: r['x'] as number,
  y: r['y'] as number,
  z: r['z'] as number,
});
const apart = (a: Spot, b: Spot) =>
  a.z === b.z ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : Infinity;

/** The middle of the hall, else the green. */
export function hallSpot(world: WorldState): Spot {
  const h = hallOf(world);
  if (!h) return greenOf(world);
  const r = rectOf(h);
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), z: 0 };
}

/** Whom the reeve seeks: the elder, else whoever living is nearest the hall (by id on a tie). */
export function soughtOf(world: WorldState): EntityRow | undefined {
  const living = alive(world);
  const elder = living.find((p) => p.id === elderOf(world));
  if (elder) return elder;
  const hall = hallSpot(world);
  let best: EntityRow | undefined;
  for (const p of living) if (!best || apart(spot(p), hall) < apart(spot(best), hall)) best = p;
  return best;
}

/** Sets the reeve on the road at the map's edge on the lord's side; none when there is no way
 * in. `causes` are the harvest-home line he comes after, then its supper's line if it was eaten.
 * With the lord (`withLord`, Slice 7) the lord's line tells of his coming, not the reeve's. */
export function sendReeve(
  ctx: SystemContext,
  causes: readonly number[],
  withLord = false,
): EntityRow | undefined {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const at = edgeSpot(world, content, lord['dir'] as string);
  const sought = soughtOf(world);
  if (!at || !sought) return undefined;
  const came = withLord
    ? 0
    : ctx.emit('lord.reeveCame', {
        causes,
        data: {
          reeve: lord['reeve'] as string,
          lord: lordName(lord),
          home: lord['home'] as string,
        },
      });
  addEntity(world, 'reeve', {
    ...{ ...at, path: [], stride: 0, going: 0, harvest: causes[0]!, came },
    ...{ seeks: sought.id, looked: world.tick, lord: 0, feast: 0, wait: 0, judged: 0 },
    favourIn: 0,
  });
  const r = reeveRow(world)!;
  walkTo(ctx, r, spot(sought));
  return r;
}

/** The words the reeve speaks in: in the lord's name, or for a child lord and their regents. */
function voiceOf(lord: EntityRow): string {
  const name = lordName(lord);
  if (!lord['child']) return `in the name of ${name}`;
  const them = lord['sex'] === 'f' ? 'her' : 'him';
  return `for the young ${name} and those who rule for ${them}`;
}

/** The first visit: the lord is named, the share owed, and each of the living remembers it,
 * weighed by the lord's temper and bitter for anyone not of the lord's people. */
function nameTheLord(ctx: SystemContext, r: EntityRow, to: EntityRow): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const words = lord['byname'] ? '' : `, ${lord['line'] as string}`;
  const line = ctx.emit('lord.named', {
    causes: [r['harvest'] as number, r['came'] as number],
    actors: [to.id],
    data: {
      ...{ reeve: lord['reeve'] as string, name: to['name'] as string, voice: voiceOf(lord) },
      ...{ words, realm: lord['realm'] as string, lord: lordName(lord) },
    },
  });
  lord['named'] = line;
  const extra = content.lord.tempers[lord['temper'] as string] ?? 0;
  const { named, bitter } = content.lord.memories;
  for (const p of alive(world)) {
    const id = p['culture'] === lord['culture'] ? named : bitter;
    addMemory(ctx, p.id, id, line, 0, extra);
  }
  // 6C Slice 2: the Lord law stands at Loyal from his word, and everyone answers it.
  swear(ctx, line);
  markForest(ctx);
}

/** A later visit: the reeve counts the store, then the tithe barn, and takes the tithe. */
function countTheStore(ctx: SystemContext, r: EntityRow, to: EntityRow): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const mouths = alive(world).length;
  const { food, days } = foodDays(world, content, mouths);
  ctx.emit('lord.counted', {
    causes: [r['harvest'] as number, r['came'] as number, lord['named'] as number],
    actors: [to.id],
    data: {
      ...{ reeve: lord['reeve'] as string, name: to['name'] as string, lord: lordName(lord) },
      ...{ food, days, mouths },
    },
  });
  const cites = [r['harvest'] as number, r['came'] as number, lord['named'] as number];
  // 6C Slice 7: in a lean year the elder may first plead for a lower tithe.
  const { line: tithed, owed } = takeTithe(ctx, cites, to, plead(ctx, r, r['came'] as number));
  // 6C Slice 3: the asks due at this visit are settled, and he brings the next.
  askAtVisit(ctx, tithed);
  // Then the ladder, so an ask given at this visit counts at it (6C review).
  climb(ctx, tithed, owed);
}

/** Speaks to `to`, then turns for home. */
function speak(ctx: SystemContext, r: EntityRow, to: EntityRow): void {
  if (lordRow(ctx.world)!['named']) countTheStore(ctx, r, to);
  else nameTheLord(ctx, r, to);
  r['going'] = 1;
  const home = edgeSpot(ctx.world, ctx.content, lordRow(ctx.world)!['dir'] as string);
  if (home) walkTo(ctx, r, home);
}

/** Gone home: down the road and out of the valley. */
function leave(ctx: SystemContext, r: EntityRow): void {
  const lord = lordRow(ctx.world)!;
  if (r['lord']) rideOut(ctx, r);
  ctx.emit('lord.reeveLeft', {
    causes: [r['harvest'] as number, r['came'] as number],
    data: { reeve: lord['reeve'] as string, home: lord['home'] as string },
  });
  removeEntity(ctx.world, 'reeve', r.id);
}

/** One minute of the reeve's day. */
export function reeveMinute(ctx: SystemContext, r: EntityRow): void {
  const { world, content } = ctx;
  const dials = content.lord.reeve;
  const hour = hourOf(world.tick);
  for (let i = 0; i < dials.pace; i += 1) stepAlong(ctx, r, false);
  if (r['going']) {
    if (!(r['path'] as number[]).length || hour >= dials.leave) leave(ctx, r);
    return;
  }
  if (r['lord'] && stayMinute(ctx, r)) return;
  let sought = alive(world).find((p) => p.id === r['seeks']);
  if (!sought || world.tick - (r['looked'] as number) >= dials.look) {
    sought = soughtOf(world);
    r['seeks'] = sought?.id ?? 0;
    r['looked'] = world.tick;
    if (sought) walkTo(ctx, r, spot(sought));
  }
  if (!sought) return leave(ctx, r);
  if (apart(spot(r), spot(sought)) <= dials.reach || hour >= dials.speakBy) speak(ctx, r, sought);
}
