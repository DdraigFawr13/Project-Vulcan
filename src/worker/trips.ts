// The Ledger's Trips tab and the Scouting row's small line (6W Slice 6, V-213): who is out and
// when they are due home, and each trip with its lines. Pure reads of the world.
import { content } from '../content/index.ts';
import {
  entityOf,
  recordOf,
  TICKS_PER_DAY,
  type Find,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { goodName, whenWords } from './finds.ts';
import type { TripView, TripsView } from './protocol-land.ts';
import type { LedgerLine } from './protocol.ts';

type LineOf = (e: SimEvent | Stub) => LedgerLine;

const nameOf = (w: WorldState, id: number): string =>
  (entityOf(w, 'person', id)?.['name'] as string | undefined) ?? 'The scout';

/** The trip under way, if any: the last one while its count is -1. */
const underWay = (w: WorldState): Find | undefined => {
  const last = w.map.finds.at(-1);
  return last?.count === -1 ? last : undefined;
};

/** "Edwin is out for wood, due home 18:00, Day 4 of Thaw, year 1". */
function outWords(w: WorldState, trip: Find): string {
  const due = trip.due
    ? `, ${w.tick > trip.due ? 'was due' : 'due'} home ${whenWords(trip.due)}`
    : '';
  return `${nameOf(w, trip.who)} is out for ${goodName(trip.good)}${due}`;
}

/** The Scouting row's line: who is out, else when the last trip came home. */
export function scoutingWords(w: WorldState): string {
  const out = underWay(w);
  if (out) return outWords(w, out);
  const last = w.map.finds.at(-1);
  if (!last) return 'nobody out; no trip yet';
  const days = Math.floor((w.tick - last.tick) / TICKS_PER_DAY);
  const ago = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  return `nobody out; last trip home ${ago}`;
}

/** The line a trip set out with: its own line while under way, else the line its homecoming
 * cites (gone once that day is sealed). */
function setOutOf(w: WorldState, trip: Find): number | undefined {
  if (trip.count === -1) return trip.line;
  const end = recordOf(w, trip.line);
  return end && 'causes' in end ? end.causes[0] : undefined;
}

/** Each trip's lines in one pass over the recent log: its set-out line, then every land line
 * that cites one of the trip's lines (camps, worry, the search, the homecoming). */
function linesOfTrips(w: WorldState, starts: (number | undefined)[]): SimEvent[][] {
  const owner = new Map<number, number>();
  starts.forEach((id, k) => id !== undefined && owner.set(id, k));
  const out = starts.map((): SimEvent[] => []);
  const first = Math.min(...starts.filter((s): s is number => s !== undefined));
  for (const e of w.log) {
    if (e.id < first) continue;
    let k = owner.get(e.id);
    if (k === undefined && e.type.startsWith('land.'))
      k = e.causes.map((c) => owner.get(c)).find((t) => t !== undefined);
    if (k === undefined) continue;
    owner.set(e.id, k);
    out[k]!.push(e);
  }
  return out;
}

/** Where a line's Show button goes: a camp's tile, or the find a homecoming told of. */
function atOf(e: SimEvent, trip: Find): { x: number; y: number } | undefined {
  if (e.type === 'land.toldOf') return { x: trip.x, y: trip.y };
  const { x, y } = e.data;
  return e.type === 'land.camped' && typeof x === 'number' && typeof y === 'number'
    ? { x, y }
    : undefined;
}

function tripView(
  w: WorldState,
  trip: Find,
  lines: SimEvent[],
  start: number | undefined,
  lineOf: LineOf,
): TripView {
  const out = trip.count === -1;
  const end = out ? undefined : recordOf(w, trip.line);
  const lost = end?.type === 'land.lost';
  const find = content.work.scout.goods.find((g) => g.good === trip.good)?.find;
  const outcome = out
    ? ''
    : lost
      ? 'lost with what they saw'
      : trip.count >= content.terrain.generator.known.least
        ? `told of ${find ?? goodName(trip.good)}`
        : 'no word';
  const from = start !== undefined ? recordOf(w, start)?.tick : undefined;
  const hours = from !== undefined ? Math.round(((out ? w.tick : trip.tick) - from) / 60) : -1;
  const nights = lines.filter((e) => e.type === 'land.camped').length;
  const spent = [
    hours >= 0 ? `Out ${hours} hour${hours === 1 ? '' : 's'}` : '',
    nights ? `${nights} night${nights > 1 ? 's' : ''} camped` : '',
  ];
  return {
    title: `${nameOf(w, trip.who)}, for ${goodName(trip.good)} · ${out ? 'out' : lost ? 'not home' : 'home'}`,
    sub: [spent.filter(Boolean).join(', '), outcome].filter(Boolean).join(' · '),
    lines: lines.map((e) => {
      const at = atOf(e, trip);
      return { ...lineOf(e), ...(at && { at }) };
    }),
  };
}

/** The Trips tab. */
export function tripsView(w: WorldState, lineOf: LineOf): TripsView {
  const trips = [...w.map.finds].reverse();
  const starts = trips.map((t) => setOutOf(w, t));
  const lines = trips.length ? linesOfTrips(w, starts) : [];
  const out = underWay(w);
  const goods = content.work.scout.goods.map((g) => goodName(g.good));
  const either =
    goods.length < 2 ? goods.join('') : `${goods.slice(0, -1).join(', ')} or ${goods.at(-1)}`;
  const head = out
    ? `${outWords(w, out)}.`
    : `Nobody is out. A scout goes when the ${either} the colony has and knows of falls under its stock level. Scouting is a row on each person's Work sheet.`;
  return {
    head,
    trips: trips.map((t, k) => tripView(w, t, lines[k] ?? [], starts[k], lineOf)),
  };
}
