// Skills by use (P2.5): each minute of work practises the job's skill, and enough practice raises
// it by one, never past the person's potential. A rise is a line citing the work that taught it.
import type { EngineContent, EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** One minute of `skill` practised by `p`, whose taking up of the work is line `took`. */
export function practise(ctx: SystemContext, p: EntityRow, skill: string, took: number): void {
  const { world, content } = ctx;
  const row = (world.entities['skill'] ?? []).find(
    (s) => s['person'] === p.id && s['skill'] === skill,
  );
  if (!row || (row['level'] as number) >= (row['potential'] as number)) return;
  const level = row['level'] as number;
  row['xp'] = (row['xp'] as number) + 1;
  if ((row['xp'] as number) < content.work.learn.start + content.work.learn.perLevel * level)
    return;
  row['level'] = level + 1;
  row['xp'] = 0;
  const name = content.abilities.find((a) => a.id === skill)?.name ?? skill;
  ctx.emit('skill.rose', {
    causes: took ? [took] : [],
    actors: [p.id],
    data: { name: p['name'] as string, skill: name.toLowerCase(), level: level + 1 },
  });
}

/** Minutes of practice towards the next level, and how many it takes (for the Skills tab). */
export function progressOf(content: EngineContent, row: EntityRow): [number, number] {
  const learn = content.work.learn;
  return [row['xp'] as number, learn.start + learn.perLevel * (row['level'] as number)];
}
