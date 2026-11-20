// Who taught whom (6B Bundle 6, V-189): each hour the new `skill.taught` lines (band `learn.ts`)
// become or extend a `taught` row, so the person sheet can say "Etain (stoneworking 4 to 7)".
import { addEntity } from '../entity/index.ts';
import { linesAfter } from '../log/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { taughtOf } from './tables.ts';

/** Records the taught rises since the last look. */
export function recordTaught(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const fresh = linesAfter(world.log, state['seen'] ?? 0);
  if (!fresh.length) return;
  state['seen'] = fresh.at(-1)!.id;
  for (const e of fresh) {
    if (e.type !== 'skill.taught') continue;
    const [learner, teacher] = e.actors as [number, number];
    const skill = content.abilities.find((a) => a.name.toLowerCase() === e.data['skill'])?.id ?? '';
    const level = Number(e.data['level']);
    const row = taughtOf(world).find(
      (r) => r['learner'] === learner && r['teacher'] === teacher && r['skill'] === skill,
    );
    if (row) {
      row['to'] = level;
      row['last'] = e.id;
    } else
      addEntity(world, 'taught', {
        ...{ learner, teacher, skill, from: level - 1, to: level },
        ...{ first: e.id, last: e.id },
      });
  }
}
