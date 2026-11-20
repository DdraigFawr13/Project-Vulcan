// The faith tables and their reads (6B Bundle 4, P6.8, V-143, V-187): each faith held in the valley
// as a record (a creed), each person's faith and devotion, and the feast days asked for. A creed is
// copied from content when someone first arrives with it, so a later cult or schism (Phase 6E) is
// just another row with its own founding line.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const FAITH_TABLES: Schemas = {
  /** A faith held here: its faiths.json id (`faith`), name, priest's title, the furniture kind of
   * its shrine (`kind`); the shrine piece once sited (0 before) and the line that raised it; the
   * priest (0 for none) and the line that named them. */
  creed: {
    ...{ faith: 'text', name: 'text', title: 'text', kind: 'text' },
    ...{ shrine: 'entity', line: 'event', priest: 'entity', named: 'event' },
  },
  /** A person's faith: the creed row, devotion 0 to 10, the tick they last prayed (0 never) and the
   * tick their prayer ends while at it (0 otherwise). */
  faithful: { person: 'entity', creed: 'entity', devotion: 'count', prayed: 'int', until: 'int' },
  /** A feast day: its kind (worship.json `days`), name, who it is about (0 for none, `other` the
   * second of a wedding), its month (0-based) and day of the month; the line it remembers
   * (`cause`); `state` `unasked` until a priest asks for it, then `asked` with the asking `line`
   * and tick (`since`); the year it was last kept (0 never). */
  holyday: {
    ...{ kind: 'text', name: 'text', about: 'entity', other: 'entity', month: 'int', day: 'int' },
    ...{ cause: 'event', state: 'text', line: 'event', since: 'int', kept: 'int' },
  },
};

export const creedsOf = (world: WorldState): EntityRow[] => world.entities['creed'] ?? [];
export const faithfulOf = (world: WorldState): EntityRow[] => world.entities['faithful'] ?? [];
export const holydaysOf = (world: WorldState): EntityRow[] => world.entities['holyday'] ?? [];

/** A creed's name inside a sentence: "the Wells" for "The Wells". */
export const faithWords = (creed: EntityRow): string =>
  (creed['name'] as string).replace(/^The /, 'the ');

/** A person's faith row, if they have one yet. */
export const faithOf = (world: WorldState, person: number): EntityRow | undefined =>
  faithfulOf(world).find((r) => r['person'] === person);

/** A person's creed, if they have one yet. */
export function creedOf(world: WorldState, person: number): EntityRow | undefined {
  const f = faithOf(world, person);
  return f && creedsOf(world).find((c) => c.id === f['creed']);
}

/** The living who hold a creed. */
export function holdersOf(world: WorldState, creed: number): EntityRow[] {
  const ids = new Set(
    faithfulOf(world)
      .filter((r) => r['creed'] === creed)
      .map((r) => r['person']),
  );
  return (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive' && ids.has(p.id));
}

/** A devotion in a word: lukewarm, faithful or devout (worship.json `devotion.words`). */
export function devotionWord(content: EngineContent, devotion: number): string {
  const words = content.worship.devotion.words;
  return (words.find((w) => devotion >= w.from) ?? words.at(-1)!).word;
}

/** The shrine kind a faith raises: its own (worship.json `shrine.faiths`), else the plain one. */
export const shrineKindOf = (content: EngineContent, faith: string): string =>
  content.worship.shrine.faiths[faith]?.kind ?? content.worship.shrine.kind;

/** Whether a furniture kind is a shrine. */
export const isShrine = (content: EngineContent, kind: string): boolean =>
  kind === content.worship.shrine.kind ||
  Object.values(content.worship.shrine.faiths).some((f) => f.kind === kind);

/** The creed whose feast days these are: the one with a standing (or planned) shrine and the most
 * living holders, the older first on a tie. */
export function mainCreed(world: WorldState): EntityRow | undefined {
  const raised = creedsOf(world).filter((c) => c['shrine']);
  const n = (c: EntityRow) => holdersOf(world, c.id).length;
  return raised.sort((a, b) => n(b) - n(a) || a.id - b.id)[0];
}

/** The shrine piece of a creed, if sited. */
export const shrineOf = (world: WorldState, creed: EntityRow): EntityRow | undefined =>
  (world.entities['furniture'] ?? []).find((f) => f.id === creed['shrine']);
