// The tales tables and their reads (P6.3, V-155): a story is one ledger event copied as a tale,
// with the words of its data kept so it outlives the line; a tale is what one person holds of a
// story; a belief is a content template a person holds at a strength.
import type { EngineContent, EntityRow, TaleDef, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';
import { tableOf } from '../entity/index.ts';

export const TALES_TABLES: Schemas = {
  /** `tale` a tales.json id, `event` the line it copies, `words` that line's data as JSON. */
  story: { tale: 'text', event: 'event', words: 'text' },
  /** One person's version: `level` (tales.json levels), `teller` (0: they saw it), `line` the
   * event seen or the telling heard, `heard` the game day they got it, `day` the game day they
   * last told or got it (tales untold for `forgetDays` are forgotten). */
  tale: {
    person: 'entity',
    story: 'entity',
    level: 'count',
    teller: 'entity',
    line: 'event',
    heard: 'int',
    day: 'int',
  },
  /** `belief` a tales.json belief id, `strength` 1 to 4, `line` what last fed it, `fed` its tick. */
  belief: { person: 'entity', belief: 'text', strength: 'count', line: 'event', fed: 'int' },
};

export const storiesOf = (world: WorldState): EntityRow[] => tableOf(world, 'story');

/** Every tale `person` holds, newest story first. */
export const talesOf = (world: WorldState, person: number): EntityRow[] =>
  tableOf(world, 'tale')
    .filter((t) => t['person'] === person)
    .sort((a, b) => (b['story'] as number) - (a['story'] as number));

/** Every belief `person` holds, strongest first. */
export const beliefsOf = (world: WorldState, person: number): EntityRow[] =>
  tableOf(world, 'belief')
    .filter((b) => b['person'] === person)
    .sort((a, b) => (b['strength'] as number) - (a['strength'] as number) || a.id - b.id);

export const taleDef = (content: EngineContent, id: string): TaleDef | undefined =>
  content.tales.tales.find((t) => t.id === id);

/** A story's words at `level`: "A wolf went for Bran." */
export function taleText(content: EngineContent, story: EntityRow, level: number): string {
  const def = taleDef(content, story['tale'] as string);
  if (!def) return '';
  const words = JSON.parse(story['words'] as string) as Record<string, string | number>;
  const text = def.levels[Math.min(level, def.levels.length - 1)] ?? '';
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(words[k] ?? ''));
}
