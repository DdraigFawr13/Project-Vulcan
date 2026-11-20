// Masters and apprentices (6B Bundle 6, P6.13, V-141, V-189). Once a day each master (their best
// skill at teach.json `master` or more) with no apprentice weighs the Apprentices law: under Every
// master takes one a keeper takes one; under None a keeper takes none (and parts with one they
// have); By choice, the custom (and a refuser's way), a master takes one only if they hold a
// `choose` trait or the learner is their child or a close friend. They pick their own child, then
// the friend they are closest to, then the highest gift, among the grown at least `ahead` levels
// behind who can still learn from them. The bond ends when the learner comes within `end` levels
// (both remember it), or one of them dies or leaves.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { able } from '../band/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { bondOf, grown } from '../family/index.ts';
import { answerTo, lawRow, settingOf } from '../law/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { apprenticesOf, bondNow, skillWord } from './tables.ts';

export const APPRENTICES = 'apprentices';

const skillOf = (world: WorldState, person: number, skill: string): EntityRow | undefined =>
  (world.entities['skill'] ?? []).find((s) => s['person'] === person && s['skill'] === skill);
const lv = (row: EntityRow | undefined): number => (row?.['level'] as number) ?? 0;

/** How a master keeps the law now: `all`, `choice` or `none` (a refuser keeps the custom). */
export function wayOf(world: WorldState, content: EngineContent, master: number): string {
  const s = settingOf(world, content, APPRENTICES);
  const custom = content.laws.laws.find((l) => l.id === APPRENTICES)?.start ?? '';
  const answer = answerTo(world, APPRENTICES, master)?.['answer'];
  if (s.id === custom || answer === 'refuses') return 'choice';
  return s.apprentices ?? 'choice';
}

const isChild = (q: EntityRow, master: number): boolean =>
  q['mother'] === master || q['father'] === master;
const closeness = (world: WorldState, a: number, b: number): number =>
  (bondOf(world, a, b)?.['close'] as number) ?? 0;

/** The grown who could learn `skill` from a master at `level`, best first. */
function candidates(
  world: WorldState,
  content: EngineContent,
  master: EntityRow,
  skill: string,
  level: number,
): EntityRow[] {
  const t = content.teach;
  // Able for some Work sheet kind of the skill, so they can stand beside the master at it.
  const kinds = content.jobs.filter(
    (j) => j.skill === skill && content.work.priority.jobs.includes(j.id),
  );
  const fit = (q: EntityRow): boolean => kinds.some((j) => able(content, q, j.id));
  const fits = (q: EntityRow): boolean => {
    const row = skillOf(world, q.id, skill);
    if (!row || q.id === master.id || bondNow(world, q.id)) return false;
    const cap = Math.min((row['potential'] as number) + t.past, level - 1);
    return lv(row) + t.ahead <= level && lv(row) < cap && grown(world, content, q) && fit(q);
  };
  const gift = (q: EntityRow) => (skillOf(world, q.id, skill)?.['potential'] as number) ?? 0;
  return alive(world)
    .filter(fits)
    .sort(
      (a, b) =>
        Number(isChild(b, master.id)) - Number(isChild(a, master.id)) ||
        closeness(world, master.id, b.id) - closeness(world, master.id, a.id) ||
        gift(b) - gift(a) ||
        a.id - b.id,
    );
}

/** Why a master takes this one, in words and the lines it cites; undefined if they won't. */
function reason(
  ctx: SystemContext,
  master: EntityRow,
  q: EntityRow,
  way: string,
): { why: string; causes: number[] } | undefined {
  const { world, content } = ctx;
  const w = content.teach.words;
  if (way === 'all')
    return { why: w.law, causes: [(lawRow(world, APPRENTICES)?.['line'] as number) ?? 0] };
  if (isChild(q, master.id)) return { why: w.child, causes: [(q['bornLine'] as number) ?? 0] };
  if (closeness(world, master.id, q.id) >= content.teach.friend)
    return { why: w.friend, causes: [(bondOf(world, master.id, q.id)?.['line'] as number) ?? 0] };
  const trait = (world.entities['trait'] ?? []).find(
    (r) => r['person'] === master.id && content.teach.choose.includes(r['trait'] as string),
  );
  return trait
    ? { why: w.trait.replace('{trait}', trait['trait'] as string), causes: [] }
    : undefined;
}

/** The master-level skill a master works at most (minutes practised), if they have worked at one:
 * the one an apprentice can stand beside them at (teach `help.ts`). */
function taughtSkill(
  world: WorldState,
  content: EngineContent,
  master: number,
): EntityRow | undefined {
  return (world.entities['skill'] ?? [])
    .filter(
      (s) => s['person'] === master && lv(s) >= content.teach.master && (s['used'] as number) > 0,
    )
    .sort(
      (a, b) => (b['used'] as number) - (a['used'] as number) || lv(b) - lv(a) || a.id - b.id,
    )[0];
}

/** A master with no apprentice may take one. */
function take(ctx: SystemContext, master: EntityRow): void {
  const { world, content } = ctx;
  const best = taughtSkill(world, content, master.id);
  if (!best || bondNow(world, master.id)) return;
  const way = wayOf(world, content, master.id);
  if (way === 'none') return;
  const skill = best['skill'] as string;
  const q = candidates(world, content, master, skill, lv(best))[0];
  const r = q && reason(ctx, master, q, way);
  if (!q || !r) return;
  const line = ctx.emit('teach.apprentice', {
    causes: r.causes.filter(Boolean),
    actors: [master.id, q.id],
    data: {
      ...{ master: master['name'] as string, learner: q['name'] as string },
      ...{ skill: skillWord(content, skill), why: r.why.replace('{learner}', q['name'] as string) },
    },
  });
  addEntity(world, 'apprentice', {
    ...{ master: master.id, learner: q.id, skill, line, since: world.tick, ended: 0 },
    ...{ day: 0, beside: 0 },
  });
}

/** Ends a bond that is done: the learner close enough, either gone, or a master keeping None. */
function settle(ctx: SystemContext, bond: EntityRow): void {
  const { world, content } = ctx;
  const people = world.entities['person'] ?? [];
  const m = people.find((p) => p.id === bond['master'])!;
  const l = people.find((p) => p.id === bond['learner'])!;
  const skill = bond['skill'] as string;
  const ml = lv(skillOf(world, m.id, skill));
  const ll = lv(skillOf(world, l.id, skill));
  // Done when close to the master, or as far as this master can take them (their gift plus `past`).
  const pot = (skillOf(world, l.id, skill)?.['potential'] as number) ?? 0;
  const done = ll + content.teach.end >= ml || ll >= Math.min(pot + content.teach.past, ml - 1);
  const gone = m['status'] !== 'alive' || l['status'] !== 'alive';
  const none = !gone && wayOf(world, content, m.id) === 'none';
  if (!done && !gone && !none) return;
  const data = {
    ...{ master: m['name'] as string, learner: l['name'] as string },
    ...{ skill: skillWord(content, skill), level: ll },
  };
  const causes = [bond['line'] as number];
  const line = ctx.emit(done && !gone ? 'teach.finished' : 'teach.parted', {
    causes,
    actors: [m.id, l.id],
    data,
  });
  bond['ended'] = line;
  if (!done || gone) return;
  addMemory(ctx, m.id, content.teach.memories.master, line, l.id);
  addMemory(ctx, l.id, content.teach.memories.learner, line, m.id);
}

/** The day's binding and parting. */
export function apprenticeDay(ctx: SystemContext): void {
  for (const bond of apprenticesOf(ctx.world)) if (!bond['ended']) settle(ctx, bond);
  for (const p of alive(ctx.world)) if (grown(ctx.world, ctx.content, p)) take(ctx, p);
}
