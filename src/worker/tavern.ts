// The tavern as the page shows it (6B Bundle 5, V-188): a tavern tile's page (its innkeeper, the
// ale in its casks, who is in tonight, the tales and songs of the week, the bard), and the Build
// sheet's Tavern row. Every value is the engine's answer put into words (GAME-02); nothing here
// chooses a tile or a person (V-041).
import { content } from '../content/index.ts';
import {
  buildWantOf,
  cupsHeld,
  dirFrom,
  greenOf,
  highestOn,
  homeless,
  houseAt,
  kegsOf,
  list,
  personOf,
  plansOf,
  recordOf,
  rectOf,
  songsOf,
  tavernHouse,
  tavernOf,
  TICKS_PER_DAY,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView, LedgerLine, TileView } from './protocol.ts';
import type { PastureRow } from './protocol-flock.ts';

/** The Build sheet's Tavern row: the same shape as the Pasture row. */
export type TavernRow = PastureRow;

const nameOf = (world: WorldState, id: unknown): string =>
  (personOf(world, id)?.['name'] as string | undefined) ?? '';

/** "14 cups ready in 2 casks; 20 brewing, ready in 3 days", or "the casks are dry". */
function aleWords(world: WorldState): string {
  const kegs = kegsOf(world).filter((k) => (k['cups'] as number) > 0);
  const ready = kegs.filter((k) => (k['ready'] as number) <= world.tick);
  const brewing = kegs.filter((k) => (k['ready'] as number) > world.tick);
  const cups = (ks: typeof kegs) => {
    const n = ks.reduce((sum, k) => sum + (k['cups'] as number), 0);
    return `${n} cup${n === 1 ? '' : 's'}`;
  };
  const parts: string[] = [];
  if (ready.length)
    parts.push(`${cups(ready)} ready in ${ready.length} cask${ready.length > 1 ? 's' : ''}`);
  if (brewing.length) {
    const soon = Math.min(...brewing.map((k) => k['ready'] as number));
    const days = Math.max(1, Math.ceil((soon - world.tick) / TICKS_PER_DAY));
    parts.push(`${cups(brewing)} brewing, ready in ${days} day${days > 1 ? 's' : ''}`);
  }
  return parts.join('; ') || 'the casks are dry';
}

/** Who has come in tonight. */
function tonight(world: WorldState): string {
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  const names = (world.entities['night'] ?? [])
    .filter(
      (n) => n['day'] === day && n['came'] && !(n['leave'] && (n['leave'] as number) <= world.tick),
    )
    .map((n) => nameOf(world, n['person']))
    .filter(Boolean);
  return names.length ? list(names) : 'nobody yet';
}

/** The ledger lines of the last 7 days of a type, newest last. */
function thisWeek(world: WorldState, type: string, keep: (e: SimEvent) => boolean = () => true) {
  const since = world.tick - 7 * TICKS_PER_DAY;
  return world.log.filter((e) => e.type === type && e.tick >= since && keep(e));
}

/** A tavern tile's page. */
export function tavernPlace(
  world: WorldState,
  x: number,
  y: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): Pick<TileView, 'place'> {
  const h = houseAt(world, x, y);
  const t = tavernOf(world);
  if (!h || !h['inn'] || !t || t['house'] !== h.id) return {};
  const keeper = nameOf(world, t['keeper']);
  const { job, trait } = content.tavern.bard;
  const bard = highestOn(world, content, [job, trait], 'bard');
  const where = content.tales.places.tavern;
  const told = thisWeek(world, 'tale.told', (e) => e.data['where'] === where).length;
  const sung = thisWeek(world, 'song.sung', (e) => e.data['where'] === where);
  const songs = songsOf(world).filter((s) => s['made']);
  const lines: { label: string; line: LedgerLine }[] = [];
  const add = (label: string, id: unknown): void => {
    const e = typeof id === 'number' && id ? recordOf(world, id) : undefined;
    if (e) lines.push({ label, line: lineOf(e) });
  };
  add('Last song · ', sung.at(-1)?.id);
  add('Innkeeper · ', t['kept']);
  add('Named · ', t['line']);
  return {
    place: {
      name: t['name'] as string,
      sub: 'The tavern: nobody lives here; the colony drinks, talks and sings here of an evening.',
      rows: [
        ['innkeeper', keeper || 'nobody yet'],
        ['ale', aleWords(world)],
        ['tonight', tonight(world)],
        [
          'this week',
          `${told} tale${told === 1 ? '' : 's'} told, ${sung.length} song${sung.length === 1 ? '' : 's'} sung`,
        ],
        ['bard', bard ? (bard['name'] as string) : 'nobody'],
        [
          'songs',
          songs.length ? songs.map((s) => s['name'] as string).join('; ') : 'none made yet',
        ],
      ],
      lines,
    },
  };
}

/** The Build sheet's Tavern row: its level, why it waits, and the plan once sited. */
export function tavernRow(world: WorldState): TavernRow {
  const { level } = buildWantOf(world, content, 'tavern');
  const words = content.work.priority.words;
  const want = { level, word: words[level - 1] ?? '' };
  const h = tavernHouse(world);
  if (!h) {
    const harvest = (world.entities['feast'] ?? []).some(
      (f) => f['eaten'] && !(f['couple'] as number[]).length && !f['holy'],
    );
    const need =
      level >= words.length
        ? 'waits: the Tavern row is at last'
        : !harvest
          ? 'waits for the first harvest home'
          : level > 1 && homeless(world, content).length
            ? 'waits until everyone sleeps under a roof'
            : 'the colony is looking for ground for it';
    return { want, need };
  }
  const plans = plansOf(world).filter((p) => p['house'] === h.id);
  const done = plans.filter((p) => (p['done'] as number) > 0).length;
  const state = h['state'] as string;
  const name = (tavernOf(world)?.['name'] as string | undefined) ?? 'the tavern';
  return {
    want,
    need:
      state === 'built' ? `${name} stands; ${cupsHeld(world)} cups in its casks` : 'being built',
    plan: {
      id: h.id,
      state,
      words: `A longhouse ${dirFrom(greenOf(world), rectOf(h))} of the green: ${state === 'built' ? 'built' : 'planned'}.`,
      why: h['why'] as string,
      back: state === 'plan' && !h['sent'] && done === 0,
      sent: !!h['sent'],
    },
  };
}

/** The tavern's hanging sign (6B Bundle 5 art), once it stands: just outside its door, one tile
 * along the wall (back the other way at the wall's end), where a walker sees it on the way in. */
export function tavernSign(world: WorldState): GoodsView['furniture'] {
  const h = tavernHouse(world);
  if (!h || h['state'] !== 'built') return [];
  const r = rectOf(h);
  const width = world.map.width;
  const door = h['door'] as number;
  const [x, y] = [door % width, Math.floor(door / width)];
  const side = x === r.x || x === r.x + r.w - 1;
  const [lo, hi] = side ? [r.y + 1, r.y + r.h - 2] : [r.x + 1, r.x + r.w - 2];
  const at = side ? y : x;
  const along = at + 1 <= hi ? at + 1 : Math.max(lo, at - 1);
  const out = side ? (x === r.x ? -1 : 1) : y === r.y ? -1 : 1;
  const [sx, sy] = side ? [x + out, along] : [along, y + out];
  return [{ x: sx, y: sy, z: 0, art: content.tavern.build.sign, facing: 's', plan: false }];
}
