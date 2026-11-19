// The colony tables and their reads (P6.6, V-158, V-159): the colony's standing and its causes,
// the elder, and the factions with their petitions.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const COLONY_TABLES: Schemas = {
  /** One row (kind `standing`; region owns `colony`): the colony's standing (0 to 100), the elder (0 for none), the line that named them
   * and their friends when last worked out. */
  standing: { standing: 'int', elder: 'entity', line: 'event', friends: 'ints' },
  /** A cause of standing: its kind (colony.json `standing`), points, words, the line it came
   * with, and the tick it stops counting. */
  cause: { cause: 'text', by: 'int', text: 'text', line: 'event', until: 'int' },
  /** A faction against a law's setting: its name, members, the line it formed with and when;
   * its petition: the setting it asks for, its line, the tick it is due and its state (`open`,
   * `stood`, `ignored`). */
  faction: {
    law: 'text',
    setting: 'text',
    name: 'text',
    members: 'ints',
    line: 'event',
    since: 'int',
    asks: 'text',
    petition: 'event',
    due: 'int',
    state: 'text',
  },
};

export const colonyRow = (world: WorldState): EntityRow | undefined =>
  world.entities['standing']?.[0];

/** The colony's standing, 0 to 100. */
export const standingOf = (world: WorldState, content: EngineContent): number =>
  (colonyRow(world)?.['standing'] as number | undefined) ?? content.colony.standing.start;

/** Standing in a word ("Steady"). */
export function standingWord(content: EngineContent, standing: number): string {
  const words = content.colony.standing.words;
  return (words.find((w) => standing >= w.at) ?? words[words.length - 1]!).word;
}

/** The causes still counting, biggest first. */
export const causesOf = (world: WorldState): EntityRow[] =>
  [...(world.entities['cause'] ?? [])].sort(
    (a, b) => Math.abs(b['by'] as number) - Math.abs(a['by'] as number) || b.id - a.id,
  );

/** The elder's id, 0 for none. */
export const elderOf = (world: WorldState): number =>
  (colonyRow(world)?.['elder'] as number | undefined) ?? 0;

export const factionsOf = (world: WorldState): EntityRow[] => world.entities['faction'] ?? [];

/** The faction `person` stands with against `law`, if any. */
export const factionOf = (world: WorldState, person: number, law: string): EntityRow | undefined =>
  factionsOf(world).find(
    (f) => f['law'] === law && (f['members'] as readonly number[]).includes(person),
  );
