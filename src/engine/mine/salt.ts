// Salt (5B Bundle 3, V-041, V-132): nobody orders it. The curer salts meat when salt lies in the
// stores. With a smokehouse standing, no salt in the stores and `cure.salt.want` fresh meat, game
// and fish there, the colony wants a salt seam: the mine plans a shaft by the nearest white stain
// like an ore shaft (system.ts), and miners dig it under the mine row (people/mine.ts).
import { stationsOf } from '../build/index.ts';
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { haveOf, inStore, itemsOf } from '../goods/index.ts';
import { fill, shaftFor } from './shafts.ts';
import type { ShaftSite } from './site.ts';

/** The built smokehouse, if there is one. */
const houseOf = (world: WorldState): EntityRow | undefined =>
  stationsOf(world).find((s) => s['kind'] === 'smokehouse' && s['state'] === 'built');

/** How much of `kinds` lies in a store. */
const stored = (world: WorldState, kinds: readonly string[]): number =>
  itemsOf(world)
    .filter((i) => kinds.includes(i['kind'] as string) && !i['holder'])
    .filter((i) => inStore(world, i['x'] as number, i['y'] as number, i['z'] as number))
    .reduce((n, i) => n + (i['count'] as number), 0);

/** The feature id of the salt seam (the cure's salt item). */
export const saltOf = (content: EngineContent): string => content.work.cure.salt.item;

/** Salt still to find: a seam's yield while a smokehouse stands, no salt lies in a store or is held, and
 * either `cure.salt.want` fresh meat, game and fish lie in the stores or a salt shaft is already
 * going (a dig begun is not dropped when the meat is eaten); else 0. */
export function saltShort(world: WorldState, content: EngineContent): number {
  const { from, salt } = content.work.cure;
  const def = content.features.find((f) => f.id === salt.item);
  if (!def || !houseOf(world) || stored(world, [salt.item]) > 0) return 0;
  if (haveOf(world, content, salt.item) > 0) return 0;
  return stored(world, from) >= salt.want || shaftFor(world, salt.item) ? def.amount : 0;
}

/** The line a salt shaft plan cites: the take-up of the curer at work, else the smokehouse's built
 * line (0 for none). */
export function saltCause(world: WorldState): number {
  const curer = (world.entities['person'] ?? []).find((p) => p['job'] === 'cure');
  return (curer?.['took'] as number | undefined) || ((houseOf(world)?.['made'] as number) ?? 0);
}

/** The reason for a salt shaft plan, from content. */
export const saltWhy = (
  world: WorldState,
  content: EngineContent,
  word: string,
  site: ShaftSite,
): string =>
  fill(content.work.cure.salt.why, {
    ...{ fresh: stored(world, content.work.cure.from), word },
    ...{ far: site.far, dir: site.dir },
  });
