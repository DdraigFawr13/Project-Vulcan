// The schoolroom's teacher and lessons (6B Bundle 6, P6.13, V-189 q7). The teacher is the living
// grown-up who puts Teaching highest on their Work sheet (ties to teach.json `school.teacher.trait`,
// then the lowest id): nobody is appointed (V-041). For the first `lesson.hours` of the working
// day, while there are children of school age (from `school.from` per cent of their coming of
// age), the teacher teaches at the schoolroom before other work, and each such child goes to
// lessons there: each minute both are inside, the child's strongest gift (highest potential)
// rises at the practice pace, up to `lesson.upTo`, a `skill.taught` naming the teacher.
import { clockAt, type EntityRow, type WorldState } from '../core/index.ts';
import { levelOf, gain, traitPace, walkTo } from '../band/index.ts';
import { schoolHouse, schoolRoom, type Room } from '../build/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { ageOf, grown } from '../family/index.ts';
import { highestOn } from '../inn/index.ts';
import { hoursOf } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { schoolOf } from './tables.ts';

export const TEACH = 'teach';
export const LESSON = 'lesson';

type Ctx = Pick<SystemContext, 'world' | 'content'>;

/** The schoolroom's school row, once it stands. */
export function standingSchool(world: WorldState): EntityRow | undefined {
  const h = schoolHouse(world);
  return h && h['state'] === 'built' ? schoolOf(world, h.id) : undefined;
}

/** Each hour: a built schoolroom gets its row; its teacher is whoever puts Teaching highest, and a
 * change is a line citing the schoolroom and their priority. */
export function chooseTeacher(ctx: SystemContext): void {
  const { world, content } = ctx;
  const h = schoolHouse(world);
  if (!h || h['state'] !== 'built') return;
  if (!schoolOf(world, h.id)) addEntity(world, 'school', { house: h.id, teacher: 0, kept: 0 });
  const s = schoolOf(world, h.id)!;
  const { job, trait } = content.teach.school.teacher;
  const best = highestOn(world, content, [job, trait], 'teacher');
  const id = best?.id ?? 0;
  if (id === s['teacher']) return;
  const was = s['kept'] as number;
  s['teacher'] = id;
  if (!best) {
    s['kept'] = ctx.emit('school.noTeacher', { causes: [was].filter((l) => l > 0) });
    return;
  }
  const high = levelOf(world, content, best.id, job) < content.work.priority.start;
  const prio = (world.entities['priority'] ?? []).find(
    (r) => r['person'] === best.id && r['job'] === job,
  );
  s['kept'] = ctx.emit('school.teacher', {
    causes: [h['built'] as number, (prio?.['line'] as number) ?? 0].filter(Boolean),
    actors: [best.id],
    data: { name: best['name'] as string, why: high ? content.teach.school.words.teacher : '' },
  });
}

/** Whether `p` is a child of school age. */
export function pupil(world: WorldState, content: Ctx['content'], p: EntityRow): boolean {
  const race = content.races.find((r) => r.id === p['race']);
  return (
    !!race &&
    !grown(world, content, p) &&
    ageOf(world, content, p) * 100 >= race.maturityYears * content.teach.school.from
  );
}

/** The children of school age in the valley now. */
export const pupils = (ctx: Ctx): EntityRow[] =>
  alive(ctx.world).filter((p) => pupil(ctx.world, ctx.content, p));

/** Whether it is lesson time for `p`: the first `lesson.hours` of their working day. */
function lessonTime(ctx: SystemContext, p: EntityRow, hour: number): boolean {
  const from = hoursOf(ctx.world, ctx.content, p.id).workFrom;
  return hour >= from && hour < from + ctx.content.teach.school.lesson.hours;
}

const hourOf = (ctx: SystemContext): number => clockAt(ctx.world.tick, ctx.content.calendar).hour;

const inside = (ctx: Ctx, room: Room, p: EntityRow): boolean =>
  p['z'] === 0 &&
  room.tiles.includes((p['y'] as number) * ctx.world.map.width + (p['x'] as number));

/** Walks `p` to their own tile in the room (spread by id); false if there is no way. */
export function goInside(ctx: SystemContext, room: Room, p: EntityRow): boolean {
  const t = room.tiles[(p.id * 7) % room.tiles.length]!;
  const w = ctx.world.map.width;
  return walkTo(ctx, p, { x: t % w, y: Math.floor(t / w), z: 0 });
}

/** The teacher, at lesson time with pupils, takes up teaching before other work. */
export function takeUpLessons(ctx: SystemContext, p: EntityRow): boolean {
  const s = standingSchool(ctx.world);
  if (!s) return false;
  const job = s['teacher'] === p.id ? TEACH : pupil(ctx.world, ctx.content, p) ? LESSON : '';
  if (!job || !lessonTime(ctx, p, hourOf(ctx))) return false;
  if (job === TEACH && !pupils(ctx).length) return false;
  if (job === LESSON && !alive(ctx.world).some((q) => q.id === s['teacher'])) return false;
  Object.assign(p, { job, target: -1, took: s['kept'] as number });
  return job === TEACH ? teaching(ctx, p) : atLessons(ctx, p);
}

/** A minute of teaching: to the schoolroom, then at it while lessons last. */
export function teaching(ctx: SystemContext, p: EntityRow): boolean {
  const room = schoolRoom(ctx);
  if (!room || !lessonTime(ctx, p, hourOf(ctx)) || !pupils(ctx).length) return stop(p);
  return inside(ctx, room, p) || goInside(ctx, room, p) || stop(p);
}

/** A minute at lessons: to the schoolroom; with the teacher there too, the strongest gift rises. */
export function atLessons(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const room = schoolRoom(ctx);
  const s = standingSchool(world);
  const teacher = s && alive(world).find((q) => q.id === s['teacher']);
  if (!room || !teacher || !lessonTime(ctx, p, hourOf(ctx))) return stop(p);
  if (!inside(ctx, room, p)) return goInside(ctx, room, p) || stop(p);
  if (!inside(ctx, room, teacher) || teacher['job'] !== TEACH) return true;
  const row = strongest(world, content, p);
  if (row) gain(ctx, p, row, traitPace(world, content, p.id), s['kept'] as number, teacher);
  return true;
}

/** A pupil's skill with the highest potential that lessons can still raise. */
function strongest(
  world: WorldState,
  content: Ctx['content'],
  p: EntityRow,
): EntityRow | undefined {
  const upTo = content.teach.school.lesson.upTo;
  const rows = (world.entities['skill'] ?? []).filter(
    (r) =>
      r['person'] === p.id && (r['level'] as number) < Math.min(upTo, r['potential'] as number),
  );
  return rows.sort(
    (a, b) => (b['potential'] as number) - (a['potential'] as number) || a.id - b.id,
  )[0];
}

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', target: -1 });
  return false;
}
