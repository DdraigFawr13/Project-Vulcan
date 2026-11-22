// The self tables and their reads (P6.4, V-146, V-156): the roles a person sees themselves in,
// and the life ambition some hold.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const SELF_TABLES: Schemas = {
  /** A role held (self.json): its points when last worked out, what most made it (`why`, words),
   * the line that gave it and when. */
  role: {
    person: 'entity',
    role: 'text',
    points: 'count',
    why: 'text',
    line: 'event',
    since: 'int',
  },
  /** A life ambition: its id, the skill it is about ('' for none), the line that set it, when,
   * and 1 once done. */
  ambition: {
    person: 'entity',
    ambition: 'text',
    skill: 'text',
    line: 'event',
    since: 'int',
    done: 'count',
  },
};

/** The roles `person` holds, strongest first. */
export const rolesOf = (world: WorldState, person: number): EntityRow[] =>
  (world.entities['role'] ?? [])
    .filter((r) => r['person'] === person)
    .sort((a, b) => (b['points'] as number) - (a['points'] as number) || a.id - b.id);

/** The ambition `person` holds or held, if any. */
export const ambitionOf = (world: WorldState, person: number): EntityRow | undefined =>
  (world.entities['ambition'] ?? []).find((a) => a['person'] === person);

const skillName = (content: EngineContent, skill: string): string =>
  (content.abilities.find((a) => a.id === skill)?.name ?? skill).toLowerCase();

/** An ambition in words: "to make a masterwork in smithing". */
export function ambitionText(content: EngineContent, row: EntityRow, their = 'their'): string {
  const def = content.self.ambitions.find((a) => a.id === row['ambition']);
  return (def?.text ?? '')
    .replace('{skill}', skillName(content, row['skill'] as string))
    .replace('{their}', their);
}

/** The skill `person` practises in free time for their ambition, and the line that set it. */
export function practiceOf(
  world: WorldState,
  content: EngineContent,
  person: number,
): { skill: string; line: number } | undefined {
  const a = ambitionOf(world, person);
  const def = a && content.self.ambitions.find((d) => d.id === a['ambition']);
  if (!a || !def || a['done'] || def.kind === 'house') return undefined;
  return { skill: a['skill'] as string, line: a['line'] as number };
}
