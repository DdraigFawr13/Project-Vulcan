// A bite to take along (time-use fix, V-230): someone who walked over `life.bite.far` steps to eat
// and has work to go back to takes food along for the rest of their working day, at most
// `life.bite.most` of what they ate from, in their pack (as a scout's, `land/camp.ts`), and eats
// it where they are when hungry. Anvil's fellers walked about two hours to each meal at the store.
// Nobody is sent (V-041): it is what anyone does who works far from the food. No line per bite,
// as none per meal or drink (V-036).
import type { EntityRow } from '../core/index.ts';
import { layItem, takeFrom } from '../goods/index.ts';
import { eatPack, packOfPerson } from '../land/index.ts';
import { needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lineOf } from '../band/index.ts';
import { eatStash } from './defy.ts';

export const BITE_FIELDS = {
  /** Steps on the way when they set off to eat, else 0. */
  eatWalk: 'int',
} as const;

/** Hungry, they eat what they carry where they stand: a stash pocketed from the store (P6.7),
 * else food in the pack. */
export const eatCarried = (ctx: SystemContext, p: EntityRow): boolean =>
  eatStash(ctx, p) || eatPack(ctx, p);

/** Food in `p`'s pack. */
const packFood = (ctx: SystemContext, p: EntityRow): EntityRow | undefined =>
  packOfPerson(ctx.world, p).find((i) => (ctx.content.life.eat[i['kind'] as string] ?? 0) > 0);

/** Just eaten from `food` after a long walk to it, with work waiting and `hours` of it left:
 * they take along what will keep them over their `food` line till then. */
export function takeBite(ctx: SystemContext, p: EntityRow, food: EntityRow, hours: number): void {
  const { world, content } = ctx;
  const walked = (p['eatWalk'] as number) ?? 0;
  p['eatWalk'] = 0;
  const bite = content.life.bite;
  if (walked <= bite.far || !p['job'] || hours <= 0 || packFood(ctx, p)) return;
  const def = content.life.needs.find((n) => n.id === 'food');
  const value = needOf(world, p.id, 'food')?.['value'] as number | undefined;
  const gives = content.life.eat[food['kind'] as string] ?? 0;
  // The last of the stack was just eaten: nothing left there to take.
  if (!def || value === undefined || gives <= 0 || !((food['count'] as number) > 0)) return;
  const short = def.fall * hours - (value - lineOf(ctx, p, 'food'));
  const count = Math.min(bite.most, Math.ceil(short / gives));
  if (count <= 0) return;
  const [kind, quality, made] = [
    food['kind'] as string,
    food['quality'] as string,
    food['made'] as number,
  ];
  const took = takeFrom(world, food, count);
  if (took > 0)
    layItem(
      world,
      { kind, count: took, x: -1, y: -1, z: 0, made },
      { owner: p.id, state: 'pack', quality },
    );
}
