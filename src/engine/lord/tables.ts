// The lord's and the reeve's rows (6C Slice 1, V-216). The lord is copied from the Story Generator
// world once, when the reeve first comes, and is fixed for the run (V-211); the region is not
// saved, so the copy is what a save carries.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const LORD_TABLES: Schemas = {
  /** The lord: the ruler's id in the world, name, sex, birth year, age and whether a child then,
   * temper (id, word, line), byname ('' for none), realm and the word for its kind, the title the
   * colony uses, home (the realm's seat), people (a culture id), the side the home road leaves by,
   * the reeve's name and the line the colony first heard of them on. 6C Slice 2: the favour
   * ladder's steps reached (indices), a fine and a free year owed at the next visit (1), whether
   * the forest is the colony's (1), and the forest's middle (-1 for none). 6C Slice 3: the visits
   * he has counted the store at (for his asks). 6C Slice 4: his last take (the `lord.tithed`
   * line, when and in words), kept because that day is sealed a week on. */
  lord: {
    ...{ ruler: 'int', name: 'text', sex: 'text', born: 'int', age: 'int', child: 'count' },
    ...{ temper: 'text', word: 'text', line: 'text', byname: 'text', realm: 'text' },
    ...{ kind: 'text', title: 'text', home: 'text', culture: 'text', dir: 'text' },
    ...{ reeve: 'text', named: 'event' },
    ...{ steps: 'ints', fine: 'count', free: 'count', granted: 'count', fx: 'int', fy: 'int' },
    ...{ visits: 'count', tithed: 'event', tookAt: 'int', took: 'text' },
  },
  /** The lord's favour's causes (V-222), as standing's: the cause, its worth, words, line and the
   * tick it stops counting. */
  favour: { cause: 'text', by: 'int', text: 'text', line: 'event', until: 'int' },
  /** The reeve while he is in the valley: where he stands and his way (as a person walks),
   * `going` 0 coming and 1 going home, the harvest-home line he came after, his coming line, the
   * person he seeks and the tick he last looked for them. */
  reeve: {
    ...{ x: 'int', y: 'int', z: 'int', path: 'ints', stride: 'int', going: 'count' },
    ...{ harvest: 'event', came: 'event', seeks: 'int', looked: 'int' },
  },
};

/** The colony's lord, once the reeve has first come. */
export const lordRow = (world: WorldState): EntityRow | undefined => world.entities['lord']?.[0];

/** The reeve, while he is in the valley. */
export const reeveRow = (world: WorldState): EntityRow | undefined => world.entities['reeve']?.[0];

/** "Jarl Gunnil the Builder", or "Warlord Ogrgul" for a lord with no byname. */
export function lordName(row: EntityRow): string {
  const byname = row['byname'] as string;
  return `${row['title'] as string} ${row['name'] as string}${byname ? ` ${byname}` : ''}`;
}

/** The title a realm's kind gives its ruler (lord.json `titles`), for a woman where it differs. */
export function titleOf(content: EngineContent, kind: string, sex: string): string {
  const t = content.lord.titles.find((x) => x.kind === kind) ?? content.lord.title;
  return (sex === 'f' && t.f) || t.title;
}
