// One who walks in alone for their own reasons (6C Slice 7, V-236): a wandering master. Drawn as
// any stranger is from their home, raised to `level` in their skill with a potential `reach`
// above it, dressed for the road and walking in from their home's side to the green. They stop
// there (`waits` -2), neither talked over nor turned away, until whoever asked for them settles
// it (engine asks `masters.ts`); the band's word comes only at the end of a stay.
import { clockAt, type EntityRow, type RngStream } from '../core/index.ts';
import { people } from '../entity/index.ts';
import { putOn } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { drawStranger, tradeOf, type Home } from './band.ts';
import { edgeSpot, toGreen } from './edge.ts';
import { addPerson, type NEWCOMER_FIELDS } from './row.ts';
import { drawSmithing, SMITHING } from './smithing.ts';

export interface Walker {
  home: Home;
  skill: string;
  level: number;
  reach: number;
  /** Says they come, once drawn: the line their row keeps as `arrived` and `sent`. */
  say: (p: EntityRow) => number;
  extra?: Partial<Record<keyof typeof NEWCOMER_FIELDS, number | string>>;
}

/** Someone alone walking in from `w.home`'s side to the green; undefined with no edge to come
 * from. */
export function walkIn(ctx: SystemContext, rng: RngStream, w: Walker): EntityRow | undefined {
  const { world, content } = ctx;
  const spot = edgeSpot(world, content, w.home.dir);
  if (!spot) return undefined;
  const p = drawStranger(
    rng,
    content,
    w.home,
    people(world).map((q) => q['name'] as string),
  );
  const [smith] = drawSmithing(rng, content, [p]);
  const s = w.skill === SMITHING ? smith! : p.skills[w.skill];
  if (s) Object.assign(s, { level: w.level, potential: Math.max(s.potential, w.level + w.reach) });
  p.trade = tradeOf(content.band, p.skills);
  const year = clockAt(world.tick, content.calendar).year;
  const id = addPerson(
    world,
    content,
    p,
    { ...spot, status: 'stranger', arrived: 0, born: year - p.age, rest: 0 },
    smith!,
    { reason: 'wander', waits: -2, ...w.extra },
  );
  const row = people(world).find((q) => q.id === id)!;
  const line = w.say(row);
  Object.assign(row, { arrived: line, sent: line, guest: -1 });
  for (const kind of content.clothes.newcomer) putOn(world, content, row, kind, line);
  toGreen(ctx, row);
  return row;
}
