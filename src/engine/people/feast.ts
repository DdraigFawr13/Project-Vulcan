// The harvest-home supper (5B Bundle 4, proposal P1, V-093, V-121): once the colony has called it
// (build/feast.ts), everyone free after work walks to the hall (else to the campfire) and waits.
// When all who can come are there, or an hour before bedtime, they eat the best
// food in store together: a cooked meal each if there are enough, else bread, else whatever food
// gives most. One line names what was eaten and where; everyone there remembers the feast.
import { HEARTH, feastOf, furnitureOf, hallOf, roomsOf } from '../build/index.ts';
import { clockAt, type EntityRow } from '../core/index.ts';
import { hoursOf } from '../law/index.ts';
import { itemsOf } from '../goods/index.ts';
import { isDown } from '../health/index.ts';
import { addMemories } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { eat } from './eat.ts';
import { people, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** Where the supper is: the hall's floor tiles, else the tiles round the first hearth. */
function placeOfFeast(ctx: SystemContext): { tiles: number[]; words: string } | undefined {
  const { world, content } = ctx;
  const width = world.map.width;
  const hall = hallOf(world);
  const room = hall && roomsOf(world, content).find((r) => r.h.id === hall.id)?.room;
  if (room?.tiles.length) return { tiles: [...room.tiles], words: 'in the hall' };
  const fire = furnitureOf(world)
    .filter((f) => f['kind'] === HEARTH && f['state'] === 'built' && f['z'] === 0)
    .sort((a, b) => a.id - b.id)[0];
  if (!fire) return undefined;
  const [fx, fy] = [fire['x'] as number, fire['y'] as number];
  const tiles: number[] = [];
  for (let dy = -2; dy <= 2; dy += 1)
    for (let dx = -2; dx <= 2; dx += 1) if (dx || dy) tiles.push((fy + dy) * width + fx + dx);
  return { tiles, words: 'round the fire on the green' };
}

/** The best food for one eater: a cooked meal, then bread, then the food that gives most. */
function bestFood(ctx: SystemContext): EntityRow | undefined {
  const { content } = ctx;
  const eat = content.life.eat;
  const food = itemsOf(ctx.world).filter(
    (i) =>
      !i['holder'] &&
      eat[i['kind'] as string] !== undefined &&
      !content.life.lastResort.includes(i['kind'] as string),
  );
  const order = [content.work.cook.meal, content.buildings.mill.bake.bread];
  for (const kind of order) {
    const got = food.find((i) => i['kind'] === kind);
    if (got) return got;
  }
  return food.sort((a, b) => eat[b['kind'] as string]! - eat[a['kind'] as string]!)[0];
}

/** Everyone there eats; one line, and the shared memory. */
function eatTogether(ctx: SystemContext, feast: EntityRow, words: string): void {
  const { world, content } = ctx;
  const there = (feast['there'] as number[])
    .map((id) => people(world).find((q) => q.id === id))
    .filter((q): q is EntityRow => !!q && q['status'] === 'alive');
  const names: string[] = [];
  for (const q of there) {
    const item = bestFood(ctx);
    if (!item) break;
    const name = content.items.find((i) => i.id === item['kind'])?.name ?? (item['kind'] as string);
    if (!names.includes(name)) names.push(name);
    eat(ctx, q, item);
  }
  const meal = names.length
    ? names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`
    : 'what little there was';
  const line = ctx.emit('hall.feast', {
    causes: [feast['line'] as number],
    actors: there.map((q) => q.id),
    data: { count: there.length, meal, where: words },
  });
  addMemories(
    ctx,
    there.map((q) => q.id),
    content.strangers.memories.feast,
    line,
  );
  Object.assign(feast, { state: 'eaten', eaten: line });
}

/** One minute out of work hours: on the way to the supper, waiting there, or eating it; false when
 * no supper is called or there is nowhere to hold it. */
export function feasting(ctx: SystemContext, p: EntityRow): boolean {
  const { world } = ctx;
  const feast = feastOf(world);
  if (!feast) return false;
  const place = placeOfFeast(ctx);
  if (!place) return false;
  const width = world.map.width;
  const here = spotOf(p);
  const there = feast['there'] as number[];
  if (here.z === 0 && place.tiles.includes(here.y * width + here.x)) {
    if (!there.includes(p.id)) {
      feast['there'] = [...there, p.id];
      if (!feast['start']) feast['start'] = world.tick;
    }
    const coming = people(world).filter(
      (q) => q['status'] === 'alive' && !isDown(world, q.id) && q['doing'] !== 'sleep',
    );
    const all = coming.every((q) => (feast['there'] as number[]).includes(q.id));
    // Those still at work or on their way get until an hour before bed.
    if (
      all ||
      clockAt(world.tick, ctx.content.calendar).hour >=
        hoursOf(world, ctx.content, p.id).sleepFrom - 1
    )
      eatTogether(ctx, feast, place.words);
    p['path'] = [];
    return true;
  }
  if (p['doing'] === 'feast' && (p['path'] as number[]).length) return true;
  const to = place.tiles[p.id % place.tiles.length]!;
  return walkTo(ctx, p, { x: to % width, y: Math.floor(to / width), z: 0 });
}
