// Whom each person is drawn to (P6.1): one of family.json `orientations`, drawn once by weight
// from the family's own stream, so no other draw moves. Two court only when each is drawn to the
// other; nobody is told whom to like (V-041).
import type { EngineContent, EntityRow, RngStream, WorldState } from '../core/index.ts';

/** Gives everyone without an orientation one, by the content's weights. */
export function drawOrientations(world: WorldState, content: EngineContent, rng: RngStream): void {
  const kinds = content.family.orientations.map((o) => [o.id, o.weight] as const);
  for (const p of world.entities['person'] ?? [])
    if (!p['orientation']) p['orientation'] = rng.weighted(kinds);
}

/** Whether `p` is drawn to `q`. */
export function drawnTo(content: EngineContent, p: EntityRow, q: EntityRow): boolean {
  const kind = content.family.orientations.find((o) => o.id === p['orientation'])?.drawn;
  const same = p['sex'] === q['sex'];
  return kind === 'both' || (kind === 'same' && same) || (kind === 'other' && !same);
}
