// Skills by use (P2.5): each minute of work practises the job's skill, and enough practice raises
// it by one, never past the person's potential. A rise is a line citing the work that taught it.
// 6B Bundle 6 (P6.13, V-074, V-189): practice is kept in hundredths of a minute so its pace can
// change. Traits quicken or slow it (teach.json `traits`); alone, high levels come slowly
// (`slow`); beside a master at the same work it goes `beside` per cent, beside one's own master
// (engine teach's `apprentice` rows, read as data) `apprentice` per cent, and a teacher can take a
// learner up to `past` levels beyond their potential. A taught rise names the teacher.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { far } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

const HUNDRED = 100;

const rows = (world: WorldState, kind: string): EntityRow[] => world.entities[kind] ?? [];

/** A person's row for a skill, if they have one. */
export const skillRow = (world: WorldState, person: number, skill: string): EntityRow | undefined =>
  rows(world, 'skill').find((s) => s['person'] === person && s['skill'] === skill);

/** The skill a job kind practises, or ''. */
const jobSkill = (content: EngineContent, job: unknown): string =>
  content.jobs.find((j) => j.id === job)?.skill ?? '';

/** Per cent of practice per minute from a person's traits (teach.json `traits`), at least `least`. */
export function traitPace(world: WorldState, content: EngineContent, person: number): number {
  const t = content.teach;
  let pace = HUNDRED;
  for (const r of rows(world, 'trait'))
    if (r['person'] === person) pace += t.traits[r['trait'] as string] ?? 0;
  return Math.max(t.least, pace);
}

/** The living person a learner's own bond names, with that bond's row (engine teach). */
export function masterOf(world: WorldState, learner: number): EntityRow | undefined {
  return rows(world, 'apprentice').find((a) => a['learner'] === learner && !a['ended']);
}

/** How `q` must stand to teach: the skill, the learner's level and `q`'s, how near and how far
 * ahead. */
interface Stance {
  skill: string;
  level: number;
  qLevel: number;
  reach: number;
  ahead: number;
}

/** Whether `q` teaches `p` the skill now: alive, at work in it, near enough, far enough ahead. */
function teaches(content: EngineContent, p: EntityRow, q: EntityRow, s: Stance): boolean {
  return (
    q['status'] === 'alive' &&
    q['doing'] === 'work' &&
    jobSkill(content, q['job']) === s.skill &&
    s.qLevel >= content.teach.master &&
    s.qLevel >= s.level + s.ahead &&
    far(p, q) <= s.reach
  );
}

export interface Teacher {
  person: EntityRow;
  level: number;
  /** Per cent of practice alone. */
  pace: number;
}

/** `p`'s own master, when at work in the skill within `bondReach` and ahead of them. */
function bondTeacher(
  world: WorldState,
  content: EngineContent,
  p: EntityRow,
  skill: string,
  level: number,
): Teacher | undefined {
  const t = content.teach;
  const bond = masterOf(world, p.id);
  if (!bond || bond['skill'] !== skill) return undefined;
  const q = rows(world, 'person').find((x) => x.id === bond['master']);
  const qLevel = (q && (skillRow(world, q.id, skill)?.['level'] as number)) ?? 0;
  const stance = { skill, level, qLevel, reach: t.bondReach, ahead: 1 };
  return q && teaches(content, p, q, stance)
    ? { person: q, level: qLevel, pace: t.apprentice }
    : undefined;
}

/** Who teaches `p` the skill this minute: their own master first, else the best master beside. */
export function teacherOf(
  world: WorldState,
  content: EngineContent,
  p: EntityRow,
  skill: string,
  level: number,
): Teacher | undefined {
  const own = bondTeacher(world, content, p, skill, level);
  if (own) return own;
  const t = content.teach;
  const people = rows(world, 'person');
  let best: Teacher | undefined;
  for (const s of rows(world, 'skill')) {
    if (s['skill'] !== skill || s['person'] === p.id) continue;
    const qLevel = s['level'] as number;
    if (best && qLevel <= best.level) continue;
    const q = people.find((x) => x.id === s['person']);
    if (q && teaches(content, p, q, { skill, level, qLevel, reach: t.reach, ahead: t.ahead }))
      best = { person: q, level: qLevel, pace: t.beside };
  }
  return best;
}

/** The highest level `row` can reach: its potential, or with a teacher up to `past` beyond it but
 * never above the teacher less 1. */
export function capOf(content: EngineContent, row: EntityRow, teacher?: Teacher): number {
  const potential = row['potential'] as number;
  if (!teacher) return potential;
  return Math.max(potential, Math.min(potential + content.teach.past, teacher.level - 1));
}

/** Hundredths of a minute of practice a level takes. */
export function needOf(content: EngineContent, level: number): number {
  const learn = content.work.learn;
  return (learn.start + learn.perLevel * level) * HUNDRED;
}

/** One minute of `skill` practised by `p`, whose taking up of the work is line `took`. */
export function practise(ctx: SystemContext, p: EntityRow, skill: string, took: number): void {
  const { world, content } = ctx;
  const row = skillRow(world, p.id, skill);
  if (!row) return;
  row['used'] = ((row['used'] as number) ?? 0) + 1;
  const level = row['level'] as number;
  const teacher = teacherOf(world, content, p, skill, level);
  if (level >= capOf(content, row, teacher)) return;
  const slow = !teacher && level >= content.teach.slow.from ? content.teach.slow.times : 1;
  const pace = (traitPace(world, content, p.id) * (teacher?.pace ?? HUNDRED)) / HUNDRED;
  gain(ctx, p, row, Math.max(1, Math.floor(pace / slow)), took, teacher?.person);
}

/** Adds `hundredths` of a minute of practice to `row`; a full level rises with a line naming the
 * teacher, if any, or (read from a book, engine teach) the book and the master who gave it.
 * Engine teach records who taught whom from that line. */
export function gain(
  ctx: SystemContext,
  p: EntityRow,
  row: EntityRow,
  hundredths: number,
  took: number,
  teacher?: EntityRow,
  book?: string,
): number {
  const { content } = ctx;
  const level = row['level'] as number;
  row['xp'] = (row['xp'] as number) + hundredths;
  if ((row['xp'] as number) < needOf(content, level)) return 0;
  row['level'] = level + 1;
  row['xp'] = 0;
  const skill = (content.abilities.find((a) => a.id === row['skill'])?.name ?? '').toLowerCase();
  const data = { name: p['name'] as string, skill, level: level + 1 };
  if (!teacher) return ctx.emit('skill.rose', { causes: took ? [took] : [], actors: [p.id], data });
  return ctx.emit(book ? 'skill.read' : 'skill.taught', {
    causes: took ? [took] : [],
    actors: [p.id, teacher.id],
    data: { ...data, ...(book ? { book } : { teacher: teacher['name'] as string }) },
  });
}

/** Minutes of practice towards the next level, and how many it takes (for the Skills tab). */
export function progressOf(content: EngineContent, row: EntityRow): [number, number] {
  return [
    Math.floor((row['xp'] as number) / HUNDRED),
    needOf(content, row['level'] as number) / HUNDRED,
  ];
}
