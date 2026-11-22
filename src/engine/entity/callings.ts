// What a calling pushes (6B Bundle 6, V-175, V-189 q9), read as data from engine calling's
// `calling` table so the systems it pushes (defy, tales, band, herding) need not import it:
// the living holders and their pushes.
import type { CallingPush, EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { alive } from './rows.ts';

export interface Pusher {
  person: EntityRow;
  calling: string;
  push: CallingPush;
}

/** Every calling held now by someone living, with its push. */
export function pushers(world: WorldState, content: EngineContent): Pusher[] {
  const living = alive(world);
  return (world.entities['calling'] ?? []).flatMap((row) => {
    const person = !row['ended'] && living.find((p) => p.id === row['person']);
    const def = content.callings.callings.find((c) => c.id === row['calling']);
    return person && def ? [{ person, calling: def.id, push: def.push }] : [];
  });
}

/** What `person` pushes, by their calling, if they hold one. */
export const pushOf = (
  world: WorldState,
  content: EngineContent,
  person: number,
): CallingPush | undefined => pushers(world, content).find((h) => h.person.id === person)?.push;
