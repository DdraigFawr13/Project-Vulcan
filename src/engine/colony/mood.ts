// The colony's mood (P6.6, V-146): one word, the mean of everyone's mood worded as a person's is
// (life.json `mood`), and its biggest causes: each need under its line (how far under, by its
// weight) and each memory moving mood, summed over everyone, biggest first.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { memoriesOf, moodOf, needOf } from '../needs/index.ts';

export interface MoodCause {
  /** `need` or `memory`, and its id. */
  kind: 'need' | 'memory';
  id: string;
  /** "Hungry", "On short meals". */
  name: string;
  /** How many it touches, and the mood it moves on average, in mood points. */
  people: number;
  by: number;
  /** The newest line behind it. */
  line: number;
}

export interface ColonyMood {
  value: number;
  word: string;
  /** The word's place in life.json `mood`, 0 the best. */
  rank: number;
  causes: MoodCause[];
}

const alive = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

export function colonyMood(world: WorldState, content: EngineContent): ColonyMood {
  const { life } = content;
  const band = alive(world);
  const value = band.length
    ? Math.floor(
        band.reduce((n, p) => n + ((moodOf(world, p.id)?.['value'] as number) ?? 0), 0) /
          band.length,
      )
    : 0;
  const rank = Math.max(
    0,
    life.mood.findIndex((m) => value >= m.at),
  );
  const weights = life.needs.reduce((n, d) => n + d.weight, 0);
  const sums = new Map<string, MoodCause & { total: number }>();
  const add = (key: string, c: Omit<MoodCause, 'people' | 'by'>, by: number) => {
    const had = sums.get(key);
    if (had)
      Object.assign(had, {
        people: had.people + 1,
        total: had.total + by,
        line: Math.max(had.line, c.line),
      });
    else sums.set(key, { ...c, people: 1, by: 0, total: by });
  };
  for (const p of band) {
    for (const d of life.needs) {
      const n = needOf(world, p.id, d.id);
      const v = (n?.['value'] as number | undefined) ?? 0;
      if (!n || v >= d.low) continue;
      const name = d.lowWord;
      add(
        `need.${d.id}`,
        { kind: 'need', id: d.id, name, line: (n['line'] as number) ?? 0 },
        ((v - d.low) * d.weight) / weights,
      );
    }
    for (const m of memoriesOf(world, p.id)) {
      const def = content.memories.find((x) => x.id === m['memory']);
      if (!def?.mood) continue;
      const about = band.find((q) => q.id === m['about'])?.['name'] as string | undefined;
      const name = def.text.replace('{about}', about ?? 'someone');
      add(
        `memory.${def.id}`,
        { kind: 'memory', id: def.id, name, line: m['line'] as number },
        def.mood * life.memory.weight,
      );
    }
  }
  const causes = [...sums.values()]
    .map(({ total, ...c }) => ({ ...c, by: Math.round(total / Math.max(1, band.length)) }))
    .filter((c) => c.by)
    .sort(
      (a, b) => Math.abs(b.by) - Math.abs(a.by) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    )
    .slice(0, content.colony.mood.causes);
  return { value, word: life.mood[rank]?.word ?? '', rank, causes };
}
