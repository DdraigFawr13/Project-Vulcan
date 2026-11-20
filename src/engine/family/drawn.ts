// Whom each person is drawn to (P6.1): one of family.json `orientations`, drawn once by weight
// from the family's own stream, so no other draw moves. Two court only when each is drawn to the
// other; nobody is told whom to like (V-041).
import type { EngineContent, EntityRow, RngStream, WorldState } from '../core/index.ts';

/** Draws the band's founders up to this many times for a pair who may marry and have children. */
const FOUNDER_DRAWS = 20;

/** Gives everyone without an orientation one, by the content's weights. The founders, drawn
 * first, always hold a woman and a man drawn to each other (Morgan's call, P6.1): their draw is
 * repeated until they do, and failing that the first woman and man are drawn to the other sex. */
export function drawOrientations(world: WorldState, content: EngineContent, rng: RngStream): void {
  const people = world.entities['person'] ?? [];
  const kinds = content.family.orientations.map((o) => [o.id, o.weight] as const);
  const first = people.length > 0 && people.every((p) => !p['orientation']);
  for (let k = 0; k < (first ? FOUNDER_DRAWS : 1); k += 1) {
    for (const p of people) if (!p['orientation'] || first) p['orientation'] = rng.weighted(kinds);
    if (!first || breedingPair(content, people)) return;
  }
  const other = content.family.orientations.find((o) => o.drawn === 'other');
  for (const sex of ['f', 'm']) {
    const p = people.find((x) => x['sex'] === sex);
    if (p && other) p['orientation'] = other.id;
  }
}

/** Whether a woman and a man among `people` are each drawn to the other. */
const breedingPair = (content: EngineContent, people: readonly EntityRow[]): boolean =>
  people.some(
    (p) =>
      p['sex'] === 'f' &&
      people.some((q) => q['sex'] === 'm' && drawnTo(content, p, q) && drawnTo(content, q, p)),
  );

/** Whether `p` is drawn to `q`. */
export function drawnTo(content: EngineContent, p: EntityRow, q: EntityRow): boolean {
  const kind = content.family.orientations.find((o) => o.id === p['orientation'])?.drawn;
  const same = p['sex'] === q['sex'];
  return kind === 'both' || (kind === 'same' && same) || (kind === 'other' && !same);
}
