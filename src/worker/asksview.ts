// The Asks sheet in words (6C Slice 4, V-237): each ask the colony has not settled, who asks and
// why, what and by when, what answering brings or costs (numbers from content, as standing shows
// them), how far the work has come, and who works it; and the last three settled lines. Words
// only: the levers are the engine's `takeAsk` and `passAsk`.
import { content } from '../content/index.ts';
import {
  alive,
  favourAt,
  asksOf,
  clockAt,
  liveAsks,
  lordRow,
  pronounsOf,
  recordOf,
  TICKS_PER_DAY,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { dayWords } from './memoryview.ts';
import type { AskCardView, AsksView } from './protocol-asks.ts';
import type { LedgerLine } from './protocol.ts';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/** A guest's ask (and a feud's bed) is yes or no. */
const yesNo = (a: EntityRow): boolean => a['good'] === 'guest';

/** "the valley's lord", "a neighbouring village", "turned away at the gate". */
function aboutOf(world: WorldState, a: EntityRow): string {
  switch (a['source']) {
    case 'lord':
      return "the valley's lord";
    case 'neighbour':
      return yesNo(a) ? 'turned away at the gate, from a feud at home' : 'a neighbouring village';
    case 'guest':
      return 'turned away at the gate';
    case 'faith': {
      const creed = (world.entities['creed'] ?? []).find((c) => String(c.id) === a['of']);
      const priest = alive(world).find((p) => p.id === creed?.['priest']);
      return priest
        ? `${priest['name'] as string}, its ${creed!['title'] as string}`
        : 'the shrine';
    }
    case 'wanderer':
      return 'a wandering master at the gate';
    default:
      return 'a dream';
  }
}

/** "by his next visit (the morning after harvest home)", "by 14 Leaffall (12 days)". */
function dueOf(world: WorldState, a: EntityRow): string {
  const due = a['due'] as number;
  if (!due)
    return a['source'] === 'lord'
      ? `by ${lordHis(world)} next visit (the morning after harvest home)`
      : 'by the next harvest home';
  const days = Math.max(0, Math.ceil((due - world.tick) / TICKS_PER_DAY));
  const left = days === 0 ? 'due now' : days === 1 ? '1 day' : `${days} days`;
  return `by ${dayWords(Math.floor(due / TICKS_PER_DAY))} (${left})`;
}

/** A guest's open ask, yes or no: "Answer by 18:00 tomorrow, or they go on their way." */
function answerByOf(world: WorldState, a: EntityRow): string {
  if (a['state'] !== 'open' || !yesNo(a)) return '';
  const due = a['due'] as number;
  const c = clockAt(due, content.calendar);
  const [day, today] = [Math.floor(due / TICKS_PER_DAY), Math.floor(world.tick / TICKS_PER_DAY)];
  const when = day <= today ? 'today' : day === today + 1 ? 'tomorrow' : `on ${dayWords(day)}`;
  const at = `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')} ${when}`;
  return `Answer by ${at}, or they go on their way.`;
}

/** "his" or "her", for the lord. */
const lordHis = (world: WorldState): string => {
  const lord = lordRow(world);
  return lord ? pronounsOf(lord).his : 'his';
};

/** The lord's favour moves: doubled for a temper that doubles the costs. */
function lordCosts(world: WorldState): string {
  const c = content.lord.favour.causes;
  const times = content.asks.lord.double.includes(lordRow(world)?.['temper'] as string) ? 2 : 1;
  const now = favourAt(world, content);
  return (
    `Done: ${lordHis(world)} favour ${signed(c['askDone']?.by ?? 0)}, from ${now}. Let pass: ${signed((c['askPassed']?.by ?? 0) * times)}. ` +
    `Not ready by then: ${signed((c['askLate']?.by ?? 0) * times)}.`
  );
}

/** What answering brings or costs, by who asks. */
function costsOf(world: WorldState, a: EntityRow): string {
  const r = content.asks.regard;
  const name = a['asker'] as string;
  switch (a['source']) {
    case 'lord':
      return lordCosts(world);
    case 'neighbour': {
      if (yesNo(a))
        return `Done: their village's regard ${signed(r.done)}. Let pass: ${signed(r.passed)}.`;
      const row = (world.entities['regard'] ?? []).find((g) => g['place'] === a['of']);
      const now = (row?.['regard'] as number | undefined) ?? r.start;
      return (
        `Done: ${name}'s regard for the colony ${signed(r.done)}, from ${now}, and their next ` +
        `stranger brings a gift. Let pass: ${signed(r.passed)}. Taken up and late: ${signed(r.late)}.`
      );
    }
    case 'faith':
      return 'Done: its faithful are glad. Let pass: they are soured.';
    case 'guest':
      return (
        'Taken up: they eat from the store and work a little, and those who did not speak for ' +
        'them are sour about it. At the season’s end they tell a tale by the hearth.'
      );
    case 'dream':
      return `Done: ${name} is glad of it. Let pass: ${name} is soured.`;
    default:
      return 'Taken up: they stay a season, housed and fed from the store.';
  }
}

/** A tool's tries: "Tried twice, both short of fine; the next try in 12 days." */
function triesOf(world: WorldState, a: EntityRow): string {
  const made = (a['made'] as number) || 0;
  const count = a['count'] as number;
  const at = alive(world).find((p) => p['ask'] === a.id && p['job'] !== 'haul');
  if (at) return ` ${at['name'] as string} is at the forge for it now.`;
  if (!made) return ' Whoever free can smith makes it at the forge, the most skilled first.';
  if (made <= count) return '';
  const next = (a['tried'] as number) + content.asks.retry * TICKS_PER_DAY - world.tick;
  const days = Math.max(1, Math.ceil(next / TICKS_PER_DAY));
  const tries = made === 2 ? 'twice' : `${made} times`;
  return ` Tried ${tries}, short of ${(a['quality'] as string) || 'what was asked'}; the forge tries again in ${days} day${days === 1 ? '' : 's'}.`;
}

/** How far a taken ask has come: "Not made yet: 0 of 1." or "Ready: 15 of 15 set apart…". */
function progressOf(world: WorldState, a: EntityRow): string {
  if (a['state'] !== 'taken' || yesNo(a)) return '';
  const [got, count] = [a['got'] as number, a['count'] as number];
  const where = a['source'] === 'faith' ? ' It is laid at the shrine on the day.' : '';
  if (got >= count) return `Ready: ${got} of ${count} set apart in the tithe barn.${where}`;
  const head = a['tool']
    ? `Not made yet: ${got} of ${count}.`
    : `${got} of ${count} set apart in the tithe barn.`;
  return `${head}${a['tool'] ? triesOf(world, a) : ''}`;
}

/** Who works it, and under the Lord law who will not. */
function workOf(world: WorldState, a: EntityRow): string {
  switch (a['source']) {
    case 'lord': {
      const law = content.lord.tithe.law;
      const ids = new Map(alive(world).map((p) => [p.id, p['name'] as string]));
      const refuse = (world.entities['answer'] ?? [])
        .filter(
          (r) => r['law'] === law && r['answer'] === 'refuses' && ids.has(r['person'] as number),
        )
        .map((r) => ids.get(r['person'] as number)!);
      const who = refuse.length
        ? `${refuse.join(' and ')} refuse${refuse.length > 1 ? '' : 's'} the Lord law and will not work ${lordHis(world)} asks. `
        : '';
      return `Lord law: ${who}Anyone who grumbles at it works them a quarter slower.`;
    }
    case 'faith':
      return 'Only its faithful will work it.';
    case 'neighbour':
      return yesNo(a) ? '' : 'Its own people here work it first.';
    case 'dream':
      return 'The dreamer and those of their trade work it.';
    default:
      return '';
  }
}

function cardOf(world: WorldState, a: EntityRow): AskCardView {
  const words = content.work.priority.words;
  const level = (a['level'] as number) || 0;
  return {
    id: a.id,
    source: a['source'] as string,
    asker: a['asker'] as string,
    about: aboutOf(world, a),
    why: a['line'] as number,
    says: yesNo(a)
      ? `${cap(a['what'] as string)}.`
      : `${cap(a['what'] as string)}, ${dueOf(world, a)}.`,
    answerBy: answerByOf(world, a),
    costs: costsOf(world, a),
    progress: progressOf(world, a),
    work: workOf(world, a),
    state: a['state'] as AskCardView['state'],
    level,
    levelWord: level ? words[level - 1]! : '',
    yesNo: yesNo(a),
  };
}

/** The Asks sheet: live asks by state, newest first among the waiting, by priority among the
 * taken; and the last three settled, as ledger lines (`line` words an event for the page). */
export function asksView(world: WorldState, line: (e: SimEvent | Stub) => LedgerLine): AsksView {
  const live = liveAsks(world).map((a) => cardOf(world, a));
  const open = live.filter((c) => c.state === 'open').reverse();
  const settled = asksOf(world)
    .filter((a) => (a['settled'] as number) > 0)
    .map((a) => a['settled'] as number)
    .sort((x, y) => y - x)
    .slice(0, 3)
    .flatMap((id) => {
      const e = recordOf(world, id);
      return e ? [line(e)] : [];
    });
  return {
    waiting: open.length,
    open,
    taken: live.filter((c) => c.state === 'taken').sort((x, y) => x.level - y.level || x.id - y.id),
    passed: live.filter((c) => c.state === 'passed'),
    closed: settled,
  };
}
