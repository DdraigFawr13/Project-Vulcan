// Fight or flee (P5.4a, V-109, V-111): the first thing a person's round asks (care.ts `danger`).
// Awake on the surface, with a predator in sight (8 tiles by day, 4 at night) that is not at its
// den, they decide once a sighting: STAND if bold (a bold trait, no timid one), armed (holding a
// tool of a content `armed` kind) and not alone (another within `together` tiles standing or bold
// and armed); else FLEE to the nearest house with a shut room, or away from the predator. The
// decisions of everyone who sees it in one go are one line, `wild.sighted`, naming each, at most
// an hour (the later come to their own, silently). Stance is `doing`: `stand` or `flee`, which
// holds while a predator stays in sight. Nobody is ordered (V-041); it is their own nerve.
import { clockAt, type EntityRow } from '../core/index.ts';
import { dirFrom, greenOf, housesOf, houseName, rectOf, roomAt } from '../build/index.ts';
import { heldBy, toolOf } from '../goods/index.ts';
import { isDown, stopFor } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { animalsOf, packOf, whenWord } from '../wild/index.ts';
import { people, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

const reach = (a: Spot, b: Spot): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Whether `p` is awake on the surface and on their feet: someone a predator can be seen by. */
export const upAndAbout = (ctx: SystemContext, p: EntityRow): boolean =>
  p['status'] === 'alive' && p['z'] === 0 && p['doing'] !== 'sleep' && !isDown(ctx.world, p.id);

/** Whether it is night by the folk's clock (content `folk.night`). */
export function isNight(ctx: SystemContext): boolean {
  const { from, to } = ctx.content.wild.folk.night;
  const hour = clockAt(ctx.world.tick, ctx.content.calendar).hour;
  return hour >= from || hour < to;
}

/** Whether `p` stands in a shut room (a house with a door, built): out of the predator's way. */
export const sheltered = (ctx: SystemContext, p: EntityRow): boolean =>
  p['z'] === 0 && !!roomAt(ctx.world, ctx.content, p['x'] as number, p['y'] as number);

/** The kind of tool of an `armed` kind `p` holds (the best by id order), if any. */
export function armedWith(ctx: SystemContext, p: EntityRow): string | undefined {
  const { world, content } = ctx;
  for (const item of heldBy(world, content, p.id)) {
    const kind = toolOf(content, item)?.kind;
    if (kind && content.wild.folk.armed.includes(kind)) return kind;
  }
  return undefined;
}

const hasTrait = (ctx: SystemContext, p: EntityRow, list: readonly string[]): string[] =>
  (ctx.world.entities['trait'] ?? [])
    .filter((t) => t['person'] === p.id && list.includes(t['trait'] as string))
    .map((t) => t['trait'] as string);

/** Bold and armed: ready to stand if not alone. */
const readyToStand = (ctx: SystemContext, p: EntityRow): boolean => {
  const folk = ctx.content.wild.folk;
  return (
    hasTrait(ctx, p, folk.bold).length > 0 &&
    !hasTrait(ctx, p, folk.timid).length &&
    !!armedWith(ctx, p)
  );
};

/** The wolves and bears away from their den, kept for the tick: everyone's round asks, and on
 * most minutes the list is empty and the round moves on at once. */
const PREDATORS = new WeakMap<object, { tick: number; list: EntityRow[] }>();
export function predatorsOf(ctx: SystemContext): EntityRow[] {
  const kept = PREDATORS.get(ctx.world);
  if (kept && kept.tick === ctx.world.tick) return kept.list;
  const pack = packOf(ctx.world);
  const den = pack ? { x: pack['denX'] as number, y: pack['denY'] as number, z: 0 } : undefined;
  const far = ctx.content.wild.folk.den;
  const list = animalsOf(ctx.world).filter(
    (a) => a['pack'] !== 0 && (!den || reach(spotOf(a), den) > far),
  );
  PREDATORS.set(ctx.world, { tick: ctx.world.tick, list });
  return list;
}

/** The predators `p` sees now: within sight, not at the den. */
function seenBy(ctx: SystemContext, p: EntityRow): EntityRow[] {
  const folk = ctx.content.wild.folk;
  const sight = isNight(ctx) ? folk.sight.night : folk.sight.day;
  return predatorsOf(ctx).filter((a) => reach(spotOf(a), spotOf(p)) <= sight);
}

/** The nearest house with a shut room that `p` can reach: where to run, and its name. */
export function shelterFor(
  ctx: SystemContext,
  p: EntityRow,
): { spot: Spot; house: string } | undefined {
  const { world, content } = ctx;
  const here = spotOf(p);
  const rooms = housesOf(world)
    .map((h) => ({
      h,
      spot: {
        x: (h['x'] as number) + Math.floor((h['w'] as number) / 2),
        y: (h['y'] as number) + Math.floor((h['h'] as number) / 2),
        z: 0,
      },
    }))
    .filter((r) => !!roomAt(world, content, r.spot.x, r.spot.y))
    .sort((a, b) => reach(a.spot, here) - reach(b.spot, here) || a.h.id - b.h.id);
  for (const { h, spot } of rooms)
    if (canReach(content, world.map, here, spot))
      return { spot, house: houseName(world, content, (h['of'] as number) || h.id) };
  return undefined;
}

/** Sets `p` fleeing: to a shelter, else away from `from`. Returns the house name, if any. */
function runFrom(ctx: SystemContext, p: EntityRow, from: Spot): string | undefined {
  const here = spotOf(p);
  if (sheltered(ctx, p)) {
    p['path'] = [];
    return houseNear(ctx, p);
  }
  const shelter = shelterFor(ctx, p);
  if (shelter && walkTo(ctx, p, shelter.spot)) return shelter.house;
  const map = ctx.world.map;
  const [sx, sy] = [Math.sign(here.x - from.x) || 1, Math.sign(here.y - from.y) || 1];
  for (let far = 10; far > 0; far -= 3) {
    const to = {
      x: Math.max(0, Math.min(map.width - 1, here.x + sx * far)),
      y: Math.max(0, Math.min(map.height - 1, here.y + sy * far)),
      z: 0,
    };
    if (walkTo(ctx, p, to)) break;
  }
  return undefined;
}

/** The name of the house `p` stands in. */
function houseNear(ctx: SystemContext, p: EntityRow): string | undefined {
  const { world, content } = ctx;
  const h = housesOf(world).find((r) => {
    const rect = rectOf(r);
    const [x, y] = [p['x'] as number, p['y'] as number];
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
  });
  return h ? houseName(world, content, (h['of'] as number) || h.id) : undefined;
}

const listOf = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** The decisions of everyone newly in sight of a predator, as one group: sets their stance and
 * writes the `wild.sighted` line (when none was written in the hour), naming each. */
function decide(ctx: SystemContext, group: readonly EntityRow[], seen: EntityRow): void {
  const { world, content, state } = ctx;
  const folk = content.wild.folk;
  const awake = people(world).filter((q) => upAndAbout(ctx, q));
  const allies = (q: EntityRow): boolean =>
    q['doing'] === 'stand' || (group.includes(q) && readyToStand(ctx, q));
  const stands = group.filter(
    (q) =>
      readyToStand(ctx, q) &&
      awake.some((o) => o.id !== q.id && reach(spotOf(o), spotOf(q)) <= folk.together && allies(o)),
  );
  const ran: { p: EntityRow; house?: string }[] = [];
  for (const q of group) {
    stopFor(ctx, q, false);
    q['path'] = [];
    if (stands.includes(q)) q['doing'] = 'stand';
    else {
      q['doing'] = 'flee';
      const house = runFrom(ctx, q, spotOf(seen));
      ran.push(house === undefined ? { p: q } : { p: q, house });
    }
  }
  if (state['sighted'] && world.tick - (state['sightedAt'] ?? 0) < 60) return;
  const pack = packOf(world)!;
  const green = greenOf(world);
  const when = whenWord(ctx);
  const where =
    content.wild.pack.where[(world.entities['midden'] ?? []).length ? 'midden' : 'edge'];
  const at = { x: seen['x'] as number, y: seen['y'] as number, w: 1, h: 1 };
  const came = (pack['visiting'] ? folk.words.came : folk.words.seen)
    .replace('{where}', where ?? '')
    .replace('{dir}', dirFrom(green, at))
    .replace('{when}', when);
  const weapons = [...new Set(stands.map((q) => armedWith(ctx, q)!))].map(
    (k) => content.tools.kinds.find((t) => t.id === k)?.name ?? k,
  );
  const traits = folk.bold.filter((t) => stands.some((q) => hasTrait(ctx, q, [t]).length));
  const stood = stands.length
    ? folk.words.stood
        .replace('{names}', listOf(stands.map((q) => q['name'] as string)))
        .replace('{weapons}', weapons.length === 1 ? `${weapons[0]}s` : listOf(weapons))
        .replace('{traits}', traits.join(', ')) + ' '
    : '';
  const house = ran.find((r) => r.house)?.house;
  const ranText = ran.length
    ? (house ? folk.words.ran.replace('{house}', house) : folk.words.ranAway).replace(
        '{names}',
        listOf(ran.map((r) => r.p['name'] as string)),
      )
    : '';
  const line = ctx.emit('wild.sighted', {
    causes: [
      ((pack['visiting'] && pack['shown'] ? pack['line'] : 0) as number) ||
        (pack['hungryLine'] as number) ||
        (pack['line'] as number),
    ].filter((c) => c > 0),
    actors: group.map((q) => q.id),
    data: { pack: pack['name'] as string, came, stood, ran: ranText },
  });
  state['sighted'] = line;
  state['sightedAt'] = world.tick;
  for (const q of stands) addMemory(ctx, q.id, folk.memories.stood, line);
}

/** The predator rung for `p` this minute: true when it took the minute (standing or fleeing). */
export function predatorRung(ctx: SystemContext, p: EntityRow): boolean {
  const out = predatorsOf(ctx).length > 0;
  if (!out || !upAndAbout(ctx, p)) {
    if (!out && (p['doing'] === 'flee' || p['doing'] === 'stand')) p['doing'] = '';
    return false;
  }
  const seen = seenBy(ctx, p);
  const stance = p['doing'];
  if (!seen.length) {
    if (stance === 'flee' || stance === 'stand') p['doing'] = '';
    return false;
  }
  const near = [...seen].sort(
    (a, b) => reach(spotOf(a), spotOf(p)) - reach(spotOf(b), spotOf(p)) || a.id - b.id,
  )[0]!;
  if (stance === 'stand') {
    p['path'] = [];
    return true;
  }
  if (stance === 'flee') {
    if (!(p['path'] as number[]).length && !sheltered(ctx, p)) runFrom(ctx, p, spotOf(near));
    return true;
  }
  const group = people(ctx.world).filter(
    (q) =>
      upAndAbout(ctx, q) &&
      q['doing'] !== 'stand' &&
      q['doing'] !== 'flee' &&
      (q === p || seenBy(ctx, q).length > 0),
  );
  decide(ctx, group, near);
  return true;
}
