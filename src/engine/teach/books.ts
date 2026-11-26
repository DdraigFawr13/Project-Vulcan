// Books (6B Bundle 6, P6.13, V-141, V-189 q7). With no child of school age, the schoolroom's
// teacher scribes in their free time: they go to the master they would write (the highest level
// at teach.json `master` or more whose skill has no book within `near` of it yet) while that master is
// at leisure (`book.free`), and each minute within `book.near` of them is a minute of sittings. After
// `book.minutes` the book is written ("the book of smithing, Colm's method") and kept on the
// schoolroom's shelf. In their free time someone who works at the book's skill reads it at the
// schoolroom, up to `read.minutes` an evening, at `read.pace` per cent of practice and up to the
// book's level less `read.less` (past their gift by up to `past`): a `skill.read` naming the book.
// A book whose shelf goes (the schoolroom taken down) is lost, and so is one half-written when its
// master dies or leaves (`school.bookLost` says how). A book keeps a master's skill from
// being lost when they die (loss.ts).
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { gain, goBeside, skillRow, traitPace } from '../band/index.ts';
import { furnitureOf, schoolRoom, type Room } from '../build/index.ts';
import { addEntity, alive, far } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { goInside, pupils, standingSchool } from './school.ts';
import { goneLine } from './loss.ts';
import { bookName, booksOf, keptBooks, skillWord } from './tables.ts';

export const SCRIBE = 'scribe';
export const READ = 'read';

type Ctx = Pick<SystemContext, 'world' | 'content'>;

const lv = (row: EntityRow | undefined): number => (row?.['level'] as number) ?? 0;

const isInside = (ctx: Ctx, room: Room, p: EntityRow): boolean =>
  p['z'] === 0 &&
  room.tiles.includes((p['y'] as number) * ctx.world.map.width + (p['x'] as number));

/** Whether the schoolroom stands with its shelf. */
function shelved(ctx: Ctx): Room | undefined {
  const room = schoolRoom(ctx);
  if (!room) return undefined;
  const w = ctx.world.map.width;
  const kind = ctx.content.teach.school.book.shelf;
  const has = furnitureOf(ctx.world).some(
    (f) =>
      f['kind'] === kind &&
      f['state'] === 'built' &&
      f['z'] === 0 &&
      room.tiles.includes((f['y'] as number) * w + (f['x'] as number)),
  );
  return has ? room : undefined;
}

/** The book being written, or a new one begun with the master the teacher would write next. */
function bookInHand(ctx: SystemContext, scribe: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const people = alive(world);
  const writing = booksOf(world).find((b) => b['state'] === 'writing');
  if (writing && people.some((q) => q.id === writing['master'])) return writing;
  if (writing) loseUnfinished(ctx, writing);
  // A skill is written once a kept book comes within `near` of its best (as loss.ts keeps it).
  const written = (s: EntityRow) =>
    booksOf(world).some(
      (b) =>
        b['state'] === 'kept' && b['skill'] === s['skill'] && lv(b) + content.teach.near >= lv(s),
    );
  const best = (world.entities['skill'] ?? [])
    .filter(
      (s) =>
        lv(s) >= content.teach.master &&
        s['person'] !== scribe.id &&
        people.some((q) => q.id === s['person'] && !q['stranger'] && grown(world, content, q)) &&
        !written(s),
    )
    .sort((a, b) => lv(b) - lv(a) || (a['person'] as number) - (b['person'] as number))[0];
  if (!best) return undefined;
  const master = people.find((q) => q.id === best['person'])!;
  const begun = ctx.emit('school.writing', {
    causes: [standingSchool(world)!['kept'] as number].filter(Boolean),
    actors: [scribe.id, master.id],
    data: {
      ...{ teacher: scribe['name'] as string, master: master['name'] as string },
      skill: skillWord(content, best['skill'] as string),
    },
  });
  const id = addEntity(world, 'book', {
    ...{ master: master.id, skill: best['skill'] as string, level: lv(best), scribe: scribe.id },
    ...{ state: 'writing', minutes: 0, begun, line: 0, lost: 0 },
  });
  return booksOf(world).find((b) => b.id === id);
}

/** A free minute of the teacher's, with no child of school age: beside a master at leisure, a
 * minute of sittings; false when there is nothing to write now. */
export function scribing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const s = standingSchool(world);
  if (!s || s['teacher'] !== p.id || pupils(ctx).length || !shelved(ctx)) return false;
  const book = bookInHand(ctx, p);
  const m = book && alive(world).find((q) => q.id === book['master']);
  if (!book || !m || !content.teach.school.book.free.includes(m['doing'] as string)) return false;
  Object.assign(p, { doing: 'relax', job: SCRIBE, target: m.id, took: book['begun'] as number });
  // Within `book.near` they sit together; walking, they look again every `book.look` minutes, as
  // the master strolls.
  const b = content.teach.school.book;
  if (far(p, m) > b.near) {
    if ((p['path'] as number[]).length > 0 && world.tick % b.look !== 0) return true;
    return goBeside(ctx, p, m['x'] as number, m['y'] as number, m['z'] as number);
  }
  p['path'] = [];
  book['minutes'] = (book['minutes'] as number) + 1;
  if ((book['minutes'] as number) >= content.teach.school.book.minutes) finish(ctx, book, p, m);
  return true;
}

/** The last sitting: the book is written at the master's level now and goes on the shelf. */
function finish(ctx: SystemContext, book: EntityRow, scribe: EntityRow, m: EntityRow): void {
  const level = lv(skillRow(ctx.world, m.id, book['skill'] as string));
  Object.assign(book, { state: 'kept', level: Math.max(level, lv(book)) });
  book['line'] = ctx.emit('school.book', {
    causes: [book['begun'] as number],
    actors: [scribe.id, m.id],
    data: {
      ...{ teacher: scribe['name'] as string, master: m['name'] as string },
      book: bookName(ctx.world, ctx.content, book),
    },
  });
  scribe['job'] = '';
}

/** The highest level `row` can reach reading `book`: up to the book's level less `read.less`,
 * past the gift by at most `past`. */
const readCap = (ctx: Ctx, row: EntityRow, book: EntityRow): number =>
  Math.min(
    (row['potential'] as number) + ctx.content.teach.past,
    lv(book) - ctx.content.teach.school.read.less,
  );

/** The book `p` would read now: one in a skill they work at that can still take them further,
 * the highest first. */
function bookFor(ctx: Ctx, p: EntityRow): { book: EntityRow; row: EntityRow } | undefined {
  for (const book of [...keptBooks(ctx.world)].sort((a, b) => lv(b) - lv(a) || a.id - b.id)) {
    const row = skillRow(ctx.world, p.id, book['skill'] as string);
    if (row && (row['used'] as number) > 0 && lv(row) < readCap(ctx, row, book))
      return { book, row };
  }
  return undefined;
}

/** The reader's row for today, made if need be. */
function todayOf(world: WorldState, p: EntityRow): EntityRow {
  const day = Math.floor(world.tick / TICKS_PER_DAY) + 1;
  const rows = world.entities['reader'] ?? [];
  const row = rows.find((r) => r['person'] === p.id);
  if (row) {
    if (row['day'] !== day) Object.assign(row, { day, minutes: 0 });
    return row;
  }
  addEntity(world, 'reader', { person: p.id, day, minutes: 0 });
  return (world.entities['reader'] ?? []).find((r) => r['person'] === p.id)!;
}

/** A free minute given to a book at the schoolroom, up to `read.minutes` a day; false when there
 * is none for them or today's reading is done. */
export function reading(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!grown(world, content, p) || p['stranger'] || !keptBooks(world).length) return false;
  const room = shelved(ctx);
  const today = room && todayOf(world, p);
  const r = today && (today['minutes'] as number) < content.teach.school.read.minutes;
  const want = r && bookFor(ctx, p);
  if (!room || !today || !want) return stopReading(p);
  Object.assign(p, { doing: 'relax', job: READ, target: want.book.id });
  if (!isInside(ctx, room, p))
    return (p['path'] as number[]).length > 0 || goInside(ctx, room, p) || stopReading(p);
  today['minutes'] = (today['minutes'] as number) + 1;
  const master = (world.entities['person'] ?? []).find((q) => q.id === want.book['master'])!;
  const pace = Math.floor((traitPace(world, content, p.id) * content.teach.school.read.pace) / 100);
  const name = bookName(world, content, want.book);
  gain(ctx, p, want.row, pace, want.book['line'] as number, master, name);
  return true;
}

function stopReading(p: EntityRow): false {
  if (p['job'] === READ) Object.assign(p, { job: '', target: -1 });
  return false;
}

/** A book being written whose master died or left is lost half-written, with a line citing the
 * sittings begun and the master's going. */
function loseUnfinished(ctx: SystemContext, book: EntityRow): void {
  const { world, content } = ctx;
  const m = (world.entities['person'] ?? []).find((q) => q.id === book['master']);
  const gone = goneLine(world.log, book['master'] as number);
  const w = content.teach;
  const how = w.school.words.unfinished
    .replace('{master}', (m?.['name'] as string) ?? 'the master')
    .replace('{how}', gone?.type === 'defy.left' ? w.words.left : w.words.died);
  book['state'] = 'lost';
  book['lost'] = ctx.emit('school.bookLost', {
    causes: [book['begun'] as number, gone?.id ?? 0].filter((l) => l > 0),
    data: { book: bookName(world, content, book), how },
  });
}

/** A finished book brought from elsewhere (a wandering scholar's, 6C Slice 7, V-236), put on the
 * schoolroom shelf on `line`; false when no shelf stands to keep it. */
export function shelveBook(
  ctx: SystemContext,
  master: EntityRow,
  book: { skill: string; level: number; line: number },
): boolean {
  if (!shelved(ctx)) return false;
  addEntity(ctx.world, 'book', {
    ...{ master: master.id, skill: book.skill, level: book.level, scribe: master.id },
    ...{ state: 'kept', minutes: 0, begun: book.line, line: book.line, lost: 0 },
  });
  return true;
}

/** Each hour: a book half-written for a master now gone is lost, and books on a shelf that no
 * longer stands are lost. */
export function loseBooks(ctx: SystemContext): void {
  const living = new Set(alive(ctx.world).map((p) => p.id));
  for (const book of booksOf(ctx.world))
    if (book['state'] === 'writing' && !living.has(book['master'] as number))
      loseUnfinished(ctx, book);
  if (!keptBooks(ctx.world).length || shelved(ctx)) return;
  for (const book of keptBooks(ctx.world)) {
    book['state'] = 'lost';
    book['lost'] = ctx.emit('school.bookLost', {
      causes: [book['line'] as number],
      data: {
        book: bookName(ctx.world, ctx.content, book),
        how: ctx.content.teach.school.words.shelf,
      },
    });
  }
}
