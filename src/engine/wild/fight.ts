// What people do to animals beyond killing game (P5.4a, V-109, V-111): a herd whose stalk failed
// bolts; a predator struck by a person is hurt (it flees, limping), struck again it dies. Fights
// themselves are the people's (people/fight.ts); the wild only keeps the animals.
import type { EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { whereWords } from './ground.ts';
import { killAnimal } from './kill.ts';
import { membersOf, packRow } from './wild.ts';

/** Sets every animal of herd `herd` running, as the sight of a person does. */
export function scareHerd(ctx: SystemContext, herd: number): void {
  const { world, content } = ctx;
  for (const a of membersOf(world, herd))
    Object.assign(a, { state: 'flee', until: world.tick + content.wild.move.fleeFor, path: [] });
  world.systems['wild']!['fleeing'] = 1;
}

/**
 * `by` (a person's id) strikes the predator `animal`, because of the line `cause`. The first
 * blow hurts it: it runs for `folk.limp` minutes (`wild.predatorWounded`). The `folk.hits`th
 * kills it (`wild.predatorKilled`, its hide, bone and offal laid where it fell). Returns the line.
 */
export function woundPredator(
  ctx: SystemContext,
  animal: EntityRow,
  by: number,
  cause: number,
): number {
  const { world, content } = ctx;
  const hits = (animal['hurt'] as number) + 1;
  if (hits >= content.wild.folk.hits) {
    const pack = packRow(world);
    if (pack && pack['size']) pack['size'] = (pack['size'] as number) - 1;
    return killAnimal(ctx, animal, by, cause, 'wild.predatorKilled');
  }
  Object.assign(animal, {
    hurt: hits,
    state: 'flee',
    until: world.tick + content.wild.folk.limp,
    path: [],
  });
  world.systems['wild']!['fleeing'] = 1;
  const person = (world.entities['person'] ?? []).find((p) => p.id === by);
  const def = content.wild.predators.find((p) => p.kind === animal['kind'])!;
  return ctx.emit('wild.predatorWounded', {
    causes: [cause].filter((c) => c > 0),
    actors: by ? [by] : [],
    data: {
      name: (person?.['name'] as string | undefined) ?? 'Someone',
      species: def.name,
      where: whereWords(world, content, animal['x'] as number, animal['y'] as number),
    },
  });
}
