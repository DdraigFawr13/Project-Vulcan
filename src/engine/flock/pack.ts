// Dusk and the pack (P5.4b): a flock left out at night draws the pack, which takes one animal at
// most once a night. The people side folds before dusk; this is what happens when nobody did.
import type { EntityRow } from '../core/index.ts';
import { removeEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { feedPack, packArrival, packOf, setLures } from '../wild/index.ts';
import { animalWord, articleOf, headOf, keptOf, flocksOf, lureTile } from './flock.ts';

/** `flock.leftOut`: nobody shut the flock in at dusk, and `why` (the people side's reason, or
 * `why.none`) says why. Once a night; returns the line. */
export function noteLeftOut(
  ctx: SystemContext,
  flock: EntityRow,
  why: string,
  byPerson: number,
): number {
  if (flock['outLine']) return flock['outLine'] as number;
  const cause = flock['line'] as number;
  const line = ctx.emit('flock.leftOut', {
    actors: byPerson ? [byPerson] : [],
    causes: cause ? [cause] : [],
    data: { why },
  });
  flock['outLine'] = flock['line'] = line;
  return line;
}

/** Minutes of the day from which a flock out of its fold draws the pack: the people side's folding
 * time (`night.from` less `fold.before`) to dawn. */
function luring(ctx: SystemContext): boolean {
  const { content, world } = ctx;
  const night = content.wild.pack.night;
  const now = world.tick % 1440;
  const from = night.from * 60 - content.flock.fold.before;
  return now >= from || now < night.to * 60;
}

/** Keeps the pack's lures to the flocks that are out: unfolded, with animals, by night. A lure is
 * set from the folding time, so one still unfolded at dusk is what the pack is sent to. */
export function syncLures(ctx: SystemContext): void {
  const { world } = ctx;
  const out = luring(ctx)
    ? flocksOf(world).filter((f) => !f['folded'] && headOf(world, f) > 0)
    : [];
  setLures(
    ctx,
    'flock',
    out.map((f) => ({ tile: lureTile(world, f), where: 'flock', rank: 0 })),
  );
}

/** The pack has reached a flock that is out: it takes the animal nearest, once a night. */
export function packTakes(ctx: SystemContext): void {
  const { world, content } = ctx;
  const pack = packOf(world);
  const arrival = pack && packArrival(world, content);
  if (!pack || !arrival) return;
  const w = world.map.width;
  for (const flock of flocksOf(world)) {
    if (flock['folded'] || !flock['outLine'] || lureTile(world, flock) !== arrival.tile) continue;
    if ((flock['takenAt'] as number) > (pack['visitAt'] as number)) continue;
    const prey = keptOf(world, flock)
      .map(
        (a) =>
          [
            a,
            Math.max(
              Math.abs((a['x'] as number) - (arrival.tile % w)),
              Math.abs((a['y'] as number) - Math.floor(arrival.tile / w)),
            ),
          ] as const,
      )
      .sort((a, b) => a[1] - b[1] || a[0].id - b[0].id)[0]?.[0];
    if (!prey) continue;
    const word = animalWord(content, prey);
    const line = ctx.emit('flock.taken', {
      causes: [
        (pack['hungryLine'] as number) || (pack['line'] as number),
        flock['outLine'] as number,
      ],
      data: { name: pack['name'] as string, a: articleOf(word), kind: word },
    });
    removeEntity(world, 'animal', prey.id);
    Object.assign(flock, { takenAt: world.tick, takenLine: line, line });
    feedPack(ctx, line);
    return;
  }
}
