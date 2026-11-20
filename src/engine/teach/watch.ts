// Children watching a parent work (6B Bundle 6, P6.13, V-074, V-189): each hour a child within
// teach.json `child.reach` of a parent at work picks up that work's skill at `child.rate` per cent
// of practice, up to `child.upTo`, so children often take up a parent's trade. A rise is the usual
// line naming the parent as teacher.
import { far, alive } from '../entity/index.ts';
import { gain, skillRow, traitPace } from '../band/index.ts';
import { grown } from '../family/index.ts';
import type { SystemContext } from '../sim/index.ts';

const MINUTES = 60;

/** The hour's watching. */
export function watchHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  const c = content.teach.child;
  const people = alive(world);
  for (const child of people) {
    if (child['doing'] === 'sleep' || grown(world, content, child)) continue;
    const parent = people.find(
      (q) =>
        (q.id === child['mother'] || q.id === child['father']) &&
        q['doing'] === 'work' &&
        far(q, child) <= c.reach,
    );
    const skill = content.jobs.find((j) => j.id === parent?.['job'])?.skill;
    const row = skill && skillRow(world, child.id, skill);
    if (!parent || !row || (row['level'] as number) >= Math.min(c.upTo, row['potential'] as number))
      continue;
    const pace = Math.floor((traitPace(world, content, child.id) * c.rate * MINUTES) / 100);
    gain(
      ctx,
      child,
      row,
      pace,
      (parent['took'] as number) || ((child['bornLine'] as number) ?? 0),
      parent,
    );
  }
}
