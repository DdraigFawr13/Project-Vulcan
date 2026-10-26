// The Health tab, the strip's badges and the dead's "doing now" in words (P5.6, P5.8). Every sentence
// is a content `health.words` template filled from the engine's rows and helpers; the page only
// shows it (GAME-02). A person never hurt has no view (the page reads that as well).
import { content } from '../content/index.ts';
import {
  bodyOf,
  clockAt,
  herbedNow,
  isDown,
  markPercent,
  openWounds,
  pronouns,
  recordOf,
  scarsOf,
  severityOf,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  woundName,
  woundsOf,
  woundWords,
  type EntityRow,
  type SimEvent,
  type WorldState,
} from '../engine/index.ts';
import { illnessOf, pastIll, sickState } from './illview.ts';
import type { HealthView } from './protocol-people.ts';

const words = content.health.words;
const say = (key: string, vars: Record<string, string> = {}): string =>
  (words[key] ?? '').replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number): string => String(n).padStart(2, '0');

/** "09:40" for a moment today, "09:40, 3 Leaffall" for an earlier day. */
function stamp(world: WorldState, tick: number): string {
  const c = clockAt(tick, content.calendar);
  const time = `${pad(c.hour)}:${pad(c.minute)}`;
  return Math.floor(tick / TICKS_PER_DAY) === Math.floor(world.tick / TICKS_PER_DAY)
    ? time
    : `${time}, ${c.day} ${content.calendar.monthNames[c.month]!}`;
}

const nameOf = (world: WorldState, id: unknown): string =>
  ((world.entities['person'] ?? []).find((q) => q.id === id)?.['name'] as string) ?? '';

/** The data of a recent ledger line (a sealed one has none). */
const dataOf = (world: WorldState, id: unknown): SimEvent | undefined => {
  const e = typeof id === 'number' && id > 0 ? recordOf(world, id) : undefined;
  return e && 'data' in e ? (e as SimEvent) : undefined;
};

/** "a day", "5 days", "6 weeks". */
function span(hours: number): string {
  const days = Math.ceil(hours / 24);
  if (days <= 1) return say('lessDay');
  return days < 14
    ? say('days', { n: String(days) })
    : say('weeks', { n: String(Math.round(days / 7)) });
}

const bleeding = (w: EntityRow): boolean => (w['bleed'] as number) > 0 || !!w['mortal'];

/** A wound's care and healing in words. */
function statusOf(world: WorldState, p: EntityRow, w: EntityRow): string {
  const bound = w['bound'] as number;
  const healer = nameOf(world, w['healer']);
  if (w['state'] !== 'open')
    return bound >= 2
      ? say('closedBound', { healer, time: stamp(world, w['dressed'] as number) })
      : say('closedUnbound');
  const sev = severityOf(content, w);
  const total = sev.days * 24 * 100;
  const left = Math.max(0, total - (w['progress'] as number)) / 100;
  const abedFor = isDown(world, p.id)
    ? Math.max(0, (content.health.upAt * total) / 100 - (w['progress'] as number)) / 100
    : 0;
  const mends = abedFor
    ? say('abed', { abed: span(abedFor) }) + say('mends', { mends: span(left) })
    : say('mendsOnly', { mends: span(left) });
  const fever = w['fester'] === 1 ? say('fever') : w['fester'] === 2 ? say('feverOver') : '';
  if (bound === 0 && bleeding(w))
    return (
      (w['mortal'] || (w['bleed'] as number) >= 2 ? say('bleedFast') : say('bleedSlow')) + fever
    );
  if (bound === 1) {
    const finder = nameOf(world, bodyOf(world, p.id)?.['finder']);
    const by = finder ? say('roughBy', { name: finder }) : '';
    return say('rough', { by }) + mends + fever;
  }
  if (bound === 2) {
    const next = (w['dressed'] as number) + content.health.heal.dressEvery * TICKS_PER_HOUR;
    const due =
      world.tick > next ? say('overdue') : say('nextDressing', { next: stamp(world, next) });
    const head = say('bound', { healer, time: stamp(world, w['dressed'] as number) });
    const herbs = herbedNow(world, content, w)
      ? say('herbed')
      : (w['herbless'] as number) > (w['herbed'] as number)
        ? say('noHerbs')
        : '';
    return head + herbs + due + mends + fever;
  }
  return mends.trimStart() + fever;
}

/** The state sentence of someone alive. */
function stateOf(world: WorldState, p: EntityRow, open: EntityRow[]): string {
  const body = bodyOf(world, p.id);
  const sick = sickState(world, p, say);
  if (sick) return open.length ? `${sick} ${say('hurt')}` : sick;
  if (!open.length) {
    const marks = [
      markPercent(world, content, p.id, 'walk') < 100 ? say('markWalk') : '',
      markPercent(world, content, p.id, 'work') < 100 ? say('markWork') : '',
    ].filter(Boolean);
    const healed = woundsOf(world).some((w) => w['person'] === p.id && w['state'] === 'healed');
    return [healed ? say('healed') : say('well'), ...marks].join(' ');
  }
  const head = open.some(bleeding) ? say('hurtBleeding') : say('hurt');
  const where = body?.['carrier']
    ? say('carried')
    : isDown(world, p.id)
      ? body?.['bed']
        ? say('resting', { they: pronouns(p).they })
        : say('waiting')
      : say('mending');
  return `${head} ${where}`;
}

/** The Health view of `p`, or undefined for someone never hurt. */
export function healthOf(world: WorldState, p: EntityRow): HealthView | undefined {
  const body = bodyOf(world, p.id);
  const scars = scarsOf(world, p.id);
  const ills = (world.entities['ill'] ?? []).some((r) => r['person'] === p.id);
  if (!body && !scars.length && !ills) return undefined;
  const status = p['status'] as string;
  const alive = status === 'alive';
  const open = openWounds(world, p.id);
  const closed = woundsOf(world).filter((w) => w['person'] === p.id && w['state'] === 'closed');
  const listed = alive ? open : closed;
  const full = content.health.blood.full;
  const blood = alive ? ((body?.['blood'] as number) ?? full) : 0;
  const died = dataOf(world, body?.['died']);
  // The wound that killed them: the one the death line cites, else the graver.
  const fatal =
    closed.find((w) => died?.causes.includes(w['line'] as number)) ??
    [...closed].sort((a, b) => (b['mortal'] as number) - (a['mortal'] as number) || a.id - b.id)[0];
  const parts = content.health.parts.map((part) => {
    const here = listed.filter((w) => w['part'] === part.id);
    const state = alive
      ? here.some(bleeding)
        ? 'bleeding'
        : here.length
          ? 'healing'
          : ''
      : fatal?.['part'] === part.id
        ? 'bleeding'
        : '';
    const lasting = scars.some((m) => m['part'] === part.id);
    return { id: part.id, name: part.name, status: state || (lasting ? 'lasting' : 'none') };
  });
  const losing = open.some(bleeding);
  const line = Math.round((content.health.blood.faint * 100) / full);
  const marking = open.map((w) => severityOf(content, w)).find((s) => s.mark);
  const illness = alive ? illnessOf(world, p, say, stamp) : undefined;
  const past = alive ? pastIll(world, p, say, stamp) : undefined;
  const text = !alive
    ? status === 'buried'
      ? say('buried')
      : say('dead', { cause: String(died?.data['cause'] ?? '') }).trim()
    : stateOf(world, p, open);
  return {
    ...(status === 'dead' && { badge: 'dead' as const }),
    ...(alive &&
      (isDown(world, p.id) || !!illness || open.some((w) => severityOf(content, w).bleed > 0)) && {
        badge: 'hurt' as const,
      }),
    ...(status === 'buried' && { buried: true as const }),
    text,
    blood: {
      share: Math.round((blood * 100) / full),
      line,
      word: !alive
        ? ''
        : losing
          ? say('bloodLosing')
          : blood < full
            ? say('bloodRecovering')
            : say('bloodWell'),
      low: alive && blood < content.health.blood.faint,
    },
    parts,
    wounds: listed.map((w) => {
      const cause = dataOf(world, w['line']);
      const what = cause ? cap(String(cause.data['what'])) : cap(woundWords(content, w, p));
      return {
        title: `${cap(woundName(content, w))} · ${severityOf(content, w).name}`,
        status: statusOf(world, p, w),
        cause: say('cause', { what, time: stamp(world, w['at'] as number) }),
        why: w['line'] as number,
      };
    }),
    marks: scars.map((m) => {
      const def = content.health.marks.find((d) => d.id === m['mark']);
      const part = content.health.parts.find((d) => d.id === m['part'])?.name ?? '';
      const at = recordOf(world, m['line'] as number)?.tick ?? world.tick;
      return {
        title: cap((def?.name ?? '').replace('{part}', part)),
        effect: def?.text ?? '',
        story: say('markStory', { time: stamp(world, at) }),
        why: m['line'] as number,
      };
    }),
    ...(alive &&
      !scars.length &&
      marking?.mark && {
        hint: say('hint', { severity: marking.name, pc: String(marking.mark[0]) }),
      }),
    ...(illness && { illness }),
    ...(past && { pastIll: past }),
    ...(((body?.['died'] as number) ?? 0) > 0 && { death: body!['died'] as number }),
  };
}

/** "Died at 14:20 today, in the shaft. Not yet buried." for the dead, or undefined for anyone else. */
export function deadNow(
  world: WorldState,
  p: EntityRow,
): { text: string; why?: number } | undefined {
  const status = p['status'];
  if (status !== 'dead' && status !== 'buried') return undefined;
  if (status === 'buried') return { text: say('buried') };
  const id = bodyOf(world, p.id)?.['died'] as number;
  const died = dataOf(world, id);
  const at = died?.tick ?? world.tick;
  const same = Math.floor(at / TICKS_PER_DAY) === Math.floor(world.tick / TICKS_PER_DAY);
  const c = clockAt(at, content.calendar);
  const when = same
    ? say('today')
    : say('onDay', { day: `${c.day} ${content.calendar.monthNames[c.month]!}` });
  const doing = content.work.doing['dead'] ?? '';
  const text = doing
    .replace('{time}', `${pad(c.hour)}:${pad(c.minute)}`)
    .replace('{when}', when)
    .replace('{where}', String(died?.data['where'] ?? ''));
  return { text, ...(id > 0 && { why: id }) };
}
