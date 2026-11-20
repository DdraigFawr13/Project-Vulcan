// Feast days (6B Bundle 4, P6.8, V-143, V-187). The colony's own history gives them: the day the
// cart stopped, the first death and any later death most of the living grieved closely
// (`grieved` per cent), and the first wedding. Each is noted when it happens; once a priest keeps a
// shrine they ask for it each year with a line. The Feasts law keeps the first `feasts` of those
// asked for (beyond the harvest home); the rest wait on the list. On a kept day work stops at
// `feast.noon` for all but those who refuse the law, the priest leads a rite at the shrine and
// everyone eats the best food in store together (people feast.ts); an empty store skips it, a
// store under `feast.leanDays` days of food keeps it lean (the rite, no supper).
import {
  clockAt,
  START_TICK,
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { callHoly } from '../build/index.ts';
import { foodDays } from '../goods/index.ts';
import type { Hours } from '../law/index.ts';
import { lawDef, settingOf } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fill, nameOf, holydaysOf, mainCreed } from './tables.ts';

export const FEASTS = 'feasts';

const living = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** The content entry for a feast day's kind. */
export const dayDef = (content: EngineContent, kind: string) =>
  content.worship.days.find((d) => d.kind === kind)!;

/** A feast day's words: its name, and what is kept ({about}, {other}). */
export function dayWords(world: WorldState, content: EngineContent, row: EntityRow) {
  const words = {
    about: nameOf(world, row['about'] as number),
    other: nameOf(world, row['other'] as number),
  };
  const def = dayDef(content, row['kind'] as string);
  return { what: fill(def.what, words), why: fill(def.why, words) };
}

/** Notes a feast day of `kind` on the date of `tick`, remembering line `cause`. */
function note(
  ctx: SystemContext,
  kind: string,
  tick: number,
  cause: number,
  about = 0,
  other = 0,
): void {
  const { world, content } = ctx;
  const clock = clockAt(tick, content.calendar);
  const name = fill(dayDef(content, kind).name, { about: nameOf(world, about) });
  addEntity(world, 'holyday', {
    ...{ kind, name, about, other, month: clock.month, day: clock.day, cause },
    ...{ state: 'unasked', line: 0, since: 0, kept: 0 },
  });
}

/** Whether most of the living grieved a death closely (any memory of it but the band's). */
function grieved(ctx: SystemContext, died: number): boolean {
  const { world, content } = ctx;
  const alive = new Set(living(world).map((p) => p.id));
  const close = new Set(
    (world.entities['memory'] ?? [])
      .filter(
        (m) =>
          m['line'] === died &&
          m['memory'] !== content.health.mourn.band &&
          alive.has(m['person'] as number),
      )
      .map((m) => m['person']),
  );
  return alive.size > 0 && close.size * 100 >= content.worship.grieved * alive.size;
}

/** Each hour: notes the arrival once, each new death (the first always, later ones when most
 * grieved them) and the first wedding. */
export function noteDays(ctx: SystemContext): void {
  const { world, state } = ctx;
  const days = holydaysOf(world);
  if (!days.some((d) => d['kind'] === 'arrival')) {
    const came = living(world)
      .map((p) => p['arrived'] as number)
      .filter((l) => l > 0)
      .sort((a, b) => a - b)[0];
    if (came) note(ctx, 'arrival', START_TICK, came);
  }
  const seen = state['deadSeen'] ?? 0;
  const bodies = (world.entities['body'] ?? [])
    .filter((b) => (b['died'] as number) > seen)
    .sort((a, b) => (a['died'] as number) - (b['died'] as number));
  for (const b of bodies) {
    const died = b['died'] as number;
    if (!state['deadSeen'] || grieved(ctx, died))
      note(ctx, 'death', b['diedAt'] as number, died, b['person'] as number);
    state['deadSeen'] = died;
  }
  if (!state['wedSeen']) {
    const wed = (world.entities['bond'] ?? [])
      .filter((b) => b['state'] === 'wed')
      .sort((a, b) => (a['line'] as number) - (b['line'] as number))[0];
    if (wed) {
      note(
        ctx,
        'wedding',
        wed['since'] as number,
        wed['line'] as number,
        wed['a'] as number,
        wed['b'] as number,
      );
      state['wedSeen'] = 1;
    }
  }
}

/** Each hour: the priest of the main creed asks for each feast day noted and not yet asked. */
export function askDays(ctx: SystemContext): void {
  const { world, content } = ctx;
  const creed = mainCreed(world);
  const priest = creed && living(world).find((p) => p.id === creed['priest']);
  if (!priest) return;
  for (const row of holydaysOf(world).filter((d) => d['state'] === 'unasked')) {
    const line = ctx.emit('faith.dayAsked', {
      causes: [row['cause'] as number, creed['named'] as number].filter((l) => l > 0),
      actors: [priest.id],
      data: {
        name: priest['name'] as string,
        what: dayWords(world, content, row).what,
        day: row['name'] as string,
      },
    });
    Object.assign(row, { state: 'asked', line, since: world.tick });
  }
}

/** The feast days the Feasts law keeps now: the first `feasts` asked for, in the order asked
 * (none in content without the law). */
export function keptDays(world: WorldState, content: EngineContent): EntityRow[] {
  const n = lawDef(content, FEASTS) ? (settingOf(world, content, FEASTS).feasts ?? 0) : 0;
  return holydaysOf(world)
    .filter((d) => d['state'] === 'asked')
    .sort((a, b) => (a['line'] as number) - (b['line'] as number))
    .slice(0, n);
}

const today = (world: WorldState): number => Math.floor(world.tick / TICKS_PER_DAY);

/** The feast day's supper called for today, if any. */
export const holyToday = (world: WorldState): EntityRow | undefined =>
  (world.entities['feast'] ?? []).find(
    (f) => (f['holy'] as number) > 0 && f['on'] === today(world) && f['state'] === 'called',
  );

/** At the first hour of a kept day's date: its supper is called (lean under `leanDays` days of
 * food), or skipped when the store is empty; at noon, the line that work stops. */
export function feastDayHour(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const clock = clockAt(world.tick, content.calendar);
  if (clock.hour === content.worship.feast.noon && state['noon'] !== today(world) + 1) {
    const holy = holyToday(world);
    const row = holy && holydaysOf(world).find((d) => d.id === holy['holy']);
    if (row) {
      state['noon'] = today(world) + 1;
      ctx.emit('faith.feastDay', {
        causes: [holy!['line'] as number],
        data: { day: row['name'] as string },
      });
    }
  }
  for (const row of keptDays(world, content)) {
    if (row['month'] !== clock.month || row['day'] !== clock.day) continue;
    if ((row['kept'] as number) >= clock.year) continue;
    if (world.tick < (row['since'] as number) + TICKS_PER_DAY) continue;
    row['kept'] = clock.year;
    const store = foodDays(world, content, living(world).length);
    const data = { day: row['name'] as string };
    if (store.food <= 0) {
      ctx.emit('faith.noFeast', { causes: [row['line'] as number], data });
      continue;
    }
    const lean = store.days < content.worship.feast.leanDays;
    if (lean) ctx.emit('faith.leanDay', { causes: [row['line'] as number], data });
    callHoly(ctx, row['line'] as number, row.id, lean);
  }
}

/** A person's hours on a feast day: work stops at `feast.noon`, unless they refuse the Feasts
 * law (they work through it). */
export function holyHours(
  world: WorldState,
  content: EngineContent,
  person: number,
  h: Hours,
): Hours {
  if (!holyToday(world)) return h;
  const refuses = (world.entities['answer'] ?? []).some(
    (a) => a['person'] === person && a['law'] === FEASTS && a['answer'] === 'refuses',
  );
  return refuses ? h : { ...h, workTo: Math.min(h.workTo, content.worship.feast.noon) };
}
