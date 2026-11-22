// 6B Bundle 6 (P6.13, V-189 q7): the colony sites a schoolroom from the Build sheet once the
// harvest is in; its teacher is whoever puts Teaching highest; children at lessons rise in their
// strongest gift, taught by the teacher; with no children the teacher writes down a master's ways
// in the master's free time, a reader passes their gift from the book, the book keeps the master's
// skill when they die, and the book is lost with its shelf. Levers: Build and Work sheets only.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  buildSystem,
  createSim,
  createWorld,
  die,
  finishPlan,
  healthSystem,
  peopleSystem,
  plansOf,
  step,
  teachSystem,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  withoutAccidents,
  yearNow,
  type EngineContent,
  type EntityRow,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { schoolHouse, schoolRoom } from '../build/index.ts';
import { hoursOf } from '../law/index.ts';
import { loseBooks, reading, scribing } from './books.ts';
import { lossHour } from './loss.ts';
import { highestOn } from '../inn/index.ts';
import { atLessons, chooseTeacher, standingSchool } from './school.ts';
import { booksOf, keptBooks } from './tables.ts';

type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const row = (w: World, p: EntityRow, skill: string) =>
  w.entities['skill']!.find((s) => s['person'] === p.id && s['skill'] === skill)!;

/** anvil past its harvest home with the Schoolroom row at 1 (the Tavern row at last), run until
 * the schoolroom is sited; its walls are then finished at once and its shelf and table set in. */
function withSchool(tuned: EngineContent = withoutAccidents(content)) {
  const sim = createSim(tuned);
  const w = createWorld(sim, 'anvil');
  step(w, sim, TICKS_PER_HOUR);
  addEntity(w, 'feast', {
    ...{ line: w.begunEvent, year: 1, state: 'eaten', start: 0, there: [], eaten: w.begunEvent },
    ...{ couple: [], on: 0, holy: 0, lean: 0 },
  });
  addEntity(w, 'want', { kind: 'tavern', level: 4, line: 0 });
  addEntity(w, 'want', { kind: 'school', level: 1, line: 0 });
  // The teacher: whoever puts Teaching first (the least crafter, so not the master below).
  const teacher = alive(w).sort(
    (a, b) =>
      (row(w, a, 'crafting')['level'] as number) - (row(w, b, 'crafting')['level'] as number),
  )[0]!;
  addEntity(w, 'priority', { person: teacher.id, job: 'teach', level: 1, line: 0, declined: 0 });
  for (let h = 0; h < 3 && !schoolHouse(w); h += 1) step(w, sim, TICKS_PER_HOUR);
  const h = schoolHouse(w)!;
  const ctx = contextFor(w, sim, buildSystem);
  for (const p of plansOf(w).filter((r) => r['house'] === h.id))
    finishPlan(ctx, p, h['line'] as number);
  step(w, sim, TICKS_PER_HOUR);
  const room = schoolRoom({ world: w, content: tuned })!;
  const width = w.map.width;
  for (const [k, kind] of ['shelf', 'table'].entries()) {
    const i = room.tiles[k]!;
    addEntity(w, 'furniture', {
      ...{ kind, x: i % width, y: Math.floor(i / width), z: 0, facing: 's', quality: 0 },
      ...{ maker: 0, owner: 0, made: h['line'] as number, line: h['line'] as number },
      ...{ state: 'built', have: 0, work: 0, waited: 0 },
    });
  }
  step(w, sim, TICKS_PER_HOUR);
  const at = (p: EntityRow, k: number) => {
    const i = room.tiles[k]!;
    Object.assign(p, { x: i % width, y: Math.floor(i / width), z: 0, path: [] });
  };
  return { w, sim, h, room, teacher, at, people: contextFor(w, sim, peopleSystem) };
}

describe('the schoolroom', () => {
  it('is sited after the harvest home, nobody’s home, and taught by whoever puts Teaching first', () => {
    const { w, h, teacher } = withSchool();
    const sited = lines(w, 'build.school')[0]!;
    expect(sited.causes).toContain(w.begunEvent);
    expect(sited.data['why']).toContain(content.teach.school.words.masters);
    expect(h['state']).toBe('built');
    expect(h['owner']).toBe(0);
    const named = lines(w, 'school.teacher').at(-1)!;
    expect(named.actors).toEqual([teacher.id]);
    expect(named.causes).toContain(h['built']);
    expect(standingSchool(w)!['teacher']).toBe(teacher.id);
  });

  it('raises a child’s strongest gift at lessons, taught by the teacher, up to its cap', () => {
    const { w, teacher, at, people } = withSchool();
    const child = alive(w).find((p) => p.id !== teacher.id)!;
    const race = content.races.find((r) => r.id === child['race'])!;
    // Of school age: a third of the way to coming of age.
    child['born'] = yearNow(w, content) - Math.floor(race.maturityYears / 3);
    for (const s of w.entities['skill']!.filter((r) => r['person'] === child.id))
      Object.assign(s, { level: 0, xp: 0, potential: s['skill'] === 'herbalism' ? 9 : 3 });
    // A morning in lesson time, both inside, the teacher at their teaching.
    const from = hoursOf(w, content, child.id).workFrom;
    w.tick = (Math.floor(w.tick / TICKS_PER_DAY) + 1) * TICKS_PER_DAY + from * TICKS_PER_HOUR;
    at(child, 2);
    at(teacher, 3);
    Object.assign(teacher, { job: 'teach', doing: 'work' });
    for (let m = 0; m < 6000; m += 1) atLessons(people, child);
    // The strongest gift rose to the lessons' cap first, then the next; never past either cap.
    const upTo = content.teach.school.lesson.upTo;
    expect(row(w, child, 'herbalism')['level']).toBe(upTo);
    expect(row(w, child, 'farming')['level']).toBeLessThanOrEqual(3);
    const taught = lines(w, 'skill.taught').filter((e) => e.actors[0] === child.id);
    expect(taught.slice(0, upTo).map((e) => e.data['skill'])).toEqual(
      Array(upTo).fill('herbalism'),
    );
    expect(taught.every((e) => e.actors[1] === teacher.id)).toBe(true);
  });

  it('writes a master’s ways into a book that a reader learns from past their gift', () => {
    const tuned = withoutAccidents(content);
    const { w, teacher, at, people } = withSchool(tuned);
    const master = alive(w)
      .filter((p) => p.id !== teacher.id)
      .sort(
        (a, b) =>
          (row(w, b, 'crafting')['level'] as number) - (row(w, a, 'crafting')['level'] as number),
      )[0]!;
    const level = row(w, master, 'crafting')['level'] as number;
    expect(level).toBeGreaterThanOrEqual(content.teach.master);
    // Only crafting is at master level, so it is the book written.
    for (const s of w.entities['skill']!)
      if (s['skill'] !== 'crafting') s['level'] = Math.min(s['level'] as number, 5);
    Object.assign(master, { doing: 'relax' });
    at(master, 4);
    at(teacher, 4);
    for (let m = 0; m < content.teach.school.book.minutes; m += 1)
      expect(scribing(people, teacher)).toBe(true);
    const book = keptBooks(w)[0]!;
    expect([book['master'], book['skill'], book['level']]).toEqual([master.id, 'crafting', level]);
    const written = lines(w, 'school.book').at(-1)!;
    expect(written.data['book']).toBe(`the book of crafting, ${master['name'] as string}'s method`);
    expect(written.causes).toEqual([lines(w, 'school.writing').at(-1)!.id]);
    // A reader who works at crafting, gifted to 3: reading takes them 2 past it, an hour a day.
    const reader = alive(w).find((p) => p.id !== teacher.id && p.id !== master.id)!;
    Object.assign(row(w, reader, 'crafting'), { level: 1, xp: 0, potential: 3, used: 10 });
    at(reader, 6);
    const days: number[] = [];
    for (let day = 0; day < 60; day += 1, w.tick += TICKS_PER_DAY) {
      let read = 0;
      for (let m = 0; m < 90; m += 1) read += reading(people, reader) ? 1 : 0;
      days.push(read);
    }
    // An hour a day, until the book can take them no further.
    expect(days[0]).toBe(content.teach.school.read.minutes);
    expect(days.at(-1)).toBe(0);
    expect(row(w, reader, 'crafting')['level']).toBe(
      Math.min(3 + content.teach.past, level - content.teach.school.read.less),
    );
    const lesson = lines(w, 'skill.read').filter((e) => e.actors[0] === reader.id);
    expect(lesson.length).toBeGreaterThan(0);
    expect(lesson.every((e) => e.actors[1] === master.id && e.causes[0] === book['line'])).toBe(
      true,
    );
  });

  it('keeps a dead master’s skill in their book, and loses the book with its shelf', () => {
    const { w, sim, teacher, at, people } = withSchool();
    const master = alive(w)
      .filter((p) => p.id !== teacher.id)
      .sort(
        (a, b) =>
          (row(w, b, 'crafting')['level'] as number) - (row(w, a, 'crafting')['level'] as number),
      )[0]!;
    for (const s of w.entities['skill']!)
      if (s['skill'] !== 'crafting' || s['person'] !== master.id)
        s['level'] = Math.min(s['level'] as number, 5);
    Object.assign(master, { doing: 'relax' });
    at(master, 4);
    at(teacher, 4);
    for (let m = 0; m < content.teach.school.book.minutes; m += 1) scribing(people, teacher);
    expect(booksOf(w).map((b) => b['state'])).toEqual(['kept']);
    const teach = contextFor(w, sim, teachSystem);
    lossHour(teach);
    die(contextFor(w, sim, healthSystem), master, 'a fall', [w.begunEvent]);
    lossHour(teach);
    expect(lines(w, 'teach.lost').filter((e) => e.actors[0] === master.id)).toEqual([]);
    // The shelf taken away: the book goes with it.
    w.entities['furniture'] = w.entities['furniture']!.filter((f) => f['kind'] !== 'shelf');
    loseBooks(teach);
    const lost = lines(w, 'school.bookLost').at(-1)!;
    expect(lost.causes).toEqual([booksOf(w)[0]!['line']]);
    expect(lost.data['how']).toBe(content.teach.school.words.shelf);
    expect(booksOf(w)[0]!['state']).toBe('lost');
  });

  // 6B review q1 (V-206): the lines that were missing.
  it('says a half-written book is lost when its master dies', () => {
    const { w, sim, teacher, at, people } = withSchool();
    const master = alive(w)
      .filter((p) => p.id !== teacher.id)
      .sort(
        (a, b) =>
          (row(w, b, 'crafting')['level'] as number) - (row(w, a, 'crafting')['level'] as number),
      )[0]!;
    Object.assign(master, { doing: 'relax' });
    at(master, 4);
    at(teacher, 4);
    scribing(people, teacher);
    expect(booksOf(w).map((b) => b['state'])).toEqual(['writing']);
    const died = die(contextFor(w, sim, healthSystem), master, 'a fall', [w.begunEvent]);
    loseBooks(contextFor(w, sim, teachSystem));
    const lost = lines(w, 'school.bookLost').at(-1)!;
    expect(lost.causes).toEqual([booksOf(w)[0]!['begun'], died]);
    expect(lost.data['how']).toContain(`${master['name'] as string} died`);
    expect(booksOf(w)[0]!['state']).toBe('lost');
  });

  it('cites the master’s skill or coming when siting it for a master’s ways', () => {
    const { w } = withSchool();
    const sited = lines(w, 'build.school')[0]!;
    // The harvest home and the master's line: their skill rising, else their coming.
    expect(sited.causes.length).toBe(2);
    const cited = allLines(w).find((e) => e.id === sited.causes[1]);
    expect(
      cited && ['skill.rose', 'skill.taught', 'skill.read', 'people.arrived'].includes(cited.type),
    ).toBe(true);
  });

  it('says the schoolroom has no teacher when nobody grown is left', () => {
    const { w, sim } = withSchool();
    const health = contextFor(w, sim, healthSystem);
    const teacherLine = standingSchool(w)!['kept'] as number;
    for (const p of alive(w)) die(health, p, 'a fall', [w.begunEvent]);
    chooseTeacher(contextFor(w, sim, teachSystem));
    const none = lines(w, 'school.noTeacher').at(-1)!;
    expect(none.causes).toEqual([teacherLine]);
    expect(standingSchool(w)!['teacher']).toBe(0);
  });

  it('gives the schoolroom to someone who is not already the innkeeper when they tie', () => {
    const { w, sim } = withSchool();
    w.entities['priority'] = (w.entities['priority'] ?? []).filter((r) => r['job'] !== 'teach');
    const keeper = alive(w)[0]!;
    addEntity(w, 'tavern', {
      house: 0,
      name: 'The Ash',
      line: 0,
      keeper: keeper.id,
      kept: 0,
      noGrain: 0,
    });
    const { job, trait } = content.teach.school.teacher;
    expect(highestOn(w, content, [job, trait], 'teacher')?.id).not.toBe(keeper.id);
    chooseTeacher(contextFor(w, sim, teachSystem));
    expect(standingSchool(w)!['teacher']).not.toBe(keeper.id);
    const { job: bj, trait: bt } = content.tavern.bard;
    const bard = highestOn(w, content, [bj, bt], 'bard')!;
    expect([keeper.id, standingSchool(w)!['teacher']]).not.toContain(bard.id);
  });
});
