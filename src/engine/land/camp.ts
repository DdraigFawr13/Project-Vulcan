// A trip's pack and camp (6W Slice 5, V-206): a scout who expects to be out over half a day
// takes their bedroll and food from the store, eats from the pack, and sleeps where night finds
// them on the bedroll; below `camp.fire` °C, with wood about, they light a small fire that warms
// them. A camp near the wolves' den draws a hungry pack (wild `setLures`). Back home, what is
// left is carried in and their own bedroll laid where it was.
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { itemsOf, layItem, takeFrom } from '../goods/index.ts';
import { compass } from '../map/index.ts';
import { feltAt, needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { eat, lineOf, spotOf } from '../band/index.ts';
import { packOf, setLures } from '../wild/index.ts';

/** Steps apart on the larger axis. */
export const apart = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** What `p` carries in their pack: their bedroll and food, off the map (x -1). */
export const packOfPerson = (world: WorldState, p: EntityRow): EntityRow[] =>
  itemsOf(world).filter((i) => i['owner'] === p.id && i['state'] === 'pack');

/** How far `p` is from the green, and which way. */
export function awayFrom(ctx: SystemContext, p: EntityRow): { far: number; dir: string } {
  const g = greenOf(ctx.world);
  const [x, y] = [p['x'] as number, p['y'] as number];
  return { far: apart(x, y, g.x, g.y), dir: compass(x - g.x, y - g.y) };
}

/** Packs food for `days` days, the most filling lying nearest the green first, and (`roll`) a
 * bedroll. Returns the days of food packed. */
export function packUp(ctx: SystemContext, p: EntityRow, days: number, roll = true): number {
  const { world, content } = ctx;
  if (roll) packRoll(ctx, p);
  const day = (content.life.needs.find((n) => n.id === 'food')?.fall ?? 0) * 24;
  const g = greenOf(world);
  const foods = itemsOf(world)
    .filter((i) => {
      const kind = i['kind'] as string;
      return (
        !i['holder'] &&
        !i['state'] &&
        (i['x'] as number) >= 0 &&
        i['z'] === 0 &&
        (content.life.eat[kind] ?? 0) > 0 &&
        !content.life.lastResort.includes(kind) &&
        apart(i['x'] as number, i['y'] as number, g.x, g.y) <= content.work.scout.reach
      );
    })
    .sort(
      (a, b) =>
        content.life.eat[b['kind'] as string]! - content.life.eat[a['kind'] as string]! ||
        apart(a['x'] as number, a['y'] as number, g.x, g.y) -
          apart(b['x'] as number, b['y'] as number, g.x, g.y) ||
        a.id - b.id,
    );
  let want = day * days;
  let got = 0;
  for (const i of foods) {
    if (want <= 0) break;
    const gives = content.life.eat[i['kind'] as string]!;
    const [kind, quality, made] = [
      i['kind'] as string,
      i['quality'] as string,
      i['made'] as number,
    ];
    const took = takeFrom(world, i, Math.ceil(want / gives));
    layItem(
      world,
      { kind, count: took, x: -1, y: -1, z: 0, made },
      { owner: p.id, state: 'pack', quality },
    );
    want -= took * gives;
    got += took * gives;
  }
  p['packed'] = 1;
  return day > 0 ? Math.floor(got / day) : 0;
}

/** Their own laid bedroll goes in the pack, else a spare from the store. */
function packRoll(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const roll = content.life.cart.bedroll;
  const own = itemsOf(world).find(
    (i) => i['owner'] === p.id && i['kind'] === roll && i['state'] === 'laid',
  );
  const bed =
    own ??
    itemsOf(world).find(
      (i) => i['kind'] === roll && !i['owner'] && !i['holder'] && (i['x'] as number) >= 0,
    );
  if (!bed) return;
  p['rollAt'] = own ? (own['y'] as number) * world.map.width + (own['x'] as number) + 1 : 0;
  Object.assign(bed, { owner: p.id, holder: 0, state: 'pack', x: -1, y: -1, z: 0 });
}

/** Puts the pack down: home, food is carried in and their own bedroll laid where it was (a
 * store's carried in too); away (`drop`), all of it lies where they are, nobody's. */
export function unpack(ctx: SystemContext, p: EntityRow, drop = false): void {
  const { world, content } = ctx;
  const w = world.map.width;
  const at = rollSpot(p, w);
  // A camp still laid (they died asleep) goes back in the pack first.
  breakCamp(ctx, p);
  for (const i of packOfPerson(world, p)) {
    if (!drop && i['kind'] === content.life.cart.bedroll && at)
      Object.assign(i, { ...at, z: 0, holder: 0, state: 'laid' });
    else if (drop) Object.assign(i, { ...spotOf(p), holder: 0, owner: 0, state: '' });
    else Object.assign(i, { x: -1, y: -1, holder: p.id, owner: 0, state: '' });
  }
  Object.assign(p, { packed: 0, rollAt: 0, fire: 0, astray: 0 });
}

const rollSpot = (p: EntityRow, w: number): { x: number; y: number } | undefined => {
  const at = (p['rollAt'] as number) - 1;
  return at >= 0 ? { x: at % w, y: Math.floor(at / w) } : undefined;
};

/** Eats from the pack when hungry; true when they ate. With the pack empty on the way out, they
 * turn for home (one line). */
export function eatPack(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const food = needOf(world, p.id, 'food')?.['value'] as number | undefined;
  if (food === undefined || food >= lineOf(ctx, p, 'food')) return false;
  const item = packOfPerson(world, p).find((i) => (content.life.eat[i['kind'] as string] ?? 0) > 0);
  if (item) {
    eat(ctx, p, item);
    return true;
  }
  if (p['task'] !== 'out') return false;
  ctx.emit('land.packEmpty', {
    causes: [p['took'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string },
  });
  Object.assign(p, {
    task: 'home',
    path: [],
    work: world.tick + content.work.scout.leg * TICKS_PER_DAY,
  });
  return false;
}

/** Whether a tree or fallen log stands within `camp.wood` tiles: wood for a fire. */
function woodNear(ctx: SystemContext, x: number, y: number): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const r = content.work.scout.camp.wood;
  for (let yy = Math.max(0, y - r); yy <= Math.min(map.height - 1, y + r); yy += 1)
    for (let xx = Math.max(0, x - r); xx <= Math.min(map.width - 1, x + r); xx += 1) {
      const f = map.features[yy * map.width + xx]!;
      const kind = f ? content.features[f - 1]?.kind : '';
      if (kind === 'tree' || kind === 'log') return true;
    }
  return false;
}

/** The temperature where `p` stands, in whole degrees. */
const tempAt = (ctx: SystemContext, p: EntityRow): number =>
  feltAt(ctx.world, ctx.content, (p['y'] as number) * ctx.world.map.width + (p['x'] as number));

/** Lies down for the night where they are, on the bedroll from the pack, lighting a fire when
 * it is cold and wood is near; one line at night. A camp near the den draws a hungry pack. */
export function makeCamp(ctx: SystemContext, p: EntityRow, night: boolean): void {
  const { world, content } = ctx;
  const def = content.work.scout.camp;
  const roll = packOfPerson(world, p).find((i) => i['kind'] === content.life.cart.bedroll);
  if (roll) Object.assign(roll, { ...spotOf(p), state: 'laid' });
  const temp = tempAt(ctx, p);
  const fire = temp < def.fire && woodNear(ctx, p['x'] as number, p['y'] as number);
  p['fire'] = fire ? world.tick + TICKS_PER_DAY / 2 : 0;
  Object.assign(p, { doing: 'sleep', path: [], stride: 0 });
  if (!night) return;
  const { far, dir } = awayFrom(ctx, p);
  ctx.emit('land.camped', {
    causes: [p['took'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      far,
      dir,
      fire: fire ? `, and lit a fire against the cold (${temp} °C)` : '',
    },
  });
  const pack = packOf(world);
  const i = (p['y'] as number) * world.map.width + (p['x'] as number);
  if (
    pack &&
    apart(p['x'] as number, p['y'] as number, pack['denX'] as number, pack['denY'] as number) <=
      def.pack
  )
    setLures(ctx, 'camp', [{ tile: i, where: 'camp', rank: 0 }]);
}

/** Up in the morning: the bedroll goes back in the pack, the fire is left to die. */
export function breakCamp(ctx: SystemContext, p: EntityRow): void {
  for (const i of itemsOf(ctx.world))
    if (i['owner'] === p.id && i['state'] === 'laid' && (i['x'] as number) >= 0 && p['packed'])
      Object.assign(i, { x: -1, y: -1, z: 0, state: 'pack' });
  p['fire'] = 0;
  setLures(ctx, 'camp', []);
}

/** Cold on the way, under their warmth line: they stop by a small fire of the wood about for
 * `camp.warm` minutes, then walk on at least twice as long before stopping again; true while
 * they sit by it. */
export function campWarm(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const row = needOf(world, p.id, 'warmth');
  if (!row) return false;
  const value = row['value'] as number;
  const low = lineOf(ctx, p, 'warmth');
  const warm = content.work.scout.camp.warm;
  if (p['doing'] === 'warm') {
    if (world.tick < (p['fire'] as number)) return true;
    // The fire burns its hour; warm or not, they walk on a while before stopping again.
    Object.assign(p, { doing: '', fire: 0, chill: world.tick + 2 * warm });
    return false;
  }
  if (value >= low || world.tick < (p['chill'] as number)) return false;
  if (!woodNear(ctx, p['x'] as number, p['y'] as number)) return false;
  Object.assign(p, { doing: 'warm', path: [], fire: world.tick + warm });
  return true;
}
