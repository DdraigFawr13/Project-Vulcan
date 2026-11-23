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

/** The good of a trip to see what lies beyond (engine land `places.ts` `BEYOND`, V-206). */
const BEYOND = 'beyond';

/** "for wood", or "to see what lies beyond". */
const forWords = (good: string): string =>
  good === BEYOND ? 'to see what lies beyond' : `for ${goodName(good)}`;

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
  return `${nameOf(w, trip.who)} is out ${forWords(trip.good)}${due}`;
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

/** Where a line's Show button goes: a camp's tile, the find a homecoming told of, or a place the
 * scout found. */
function atOf(w: WorldState, e: SimEvent, trip: Find): { x: number; y: number } | undefined {
  if (e.type === 'land.toldOf') return { x: trip.x, y: trip.y };
  if (e.type === 'land.found') {
    const place = w.map.places.find((p) => p.line === e.id);
    return place && { x: place.x, y: place.y };
  }
  const { x, y } = e.data;
  return e.type === 'land.camped' && typeof x === 'number' && typeof y === 'number'
    ? { x, y }
    : undefined;
}

/** What came of a trip home: lost, what a beyond trip found, the find told of, or no word. */
function outcomeOf(trip: Find, end: SimEvent | Stub | undefined): string {
  if (end?.type === 'land.lost') return 'lost with what they saw';
  if (end && 'data' in end && end.type === 'land.beyond')
    return `found ${String((end as SimEvent).data['found'])}`;
  // A prospecting trip (V-215): the seam told of, or none.
  if (end?.type === 'land.toldOfSeam') return 'told of a seam';
  if (end?.type === 'land.noSeam') return 'no seam';
  const find = content.work.scout.goods.find((g) => g.good === trip.good)?.find;
  return trip.count >= content.terrain.generator.known.least
    ? `told of ${find ?? goodName(trip.good)}`
    : 'no word';
}

/** "Out 20 hours, 1 night camped", from the set-out line's tick and the camps among the lines. */
function spentOf(w: WorldState, trip: Find, lines: SimEvent[], start: number | undefined): string {
  const from = start !== undefined ? recordOf(w, start)?.tick : undefined;
  const out = trip.count === -1;
  const hours = from !== undefined ? Math.round(((out ? w.tick : trip.tick) - from) / 60) : -1;
  const nights = lines.filter((e) => e.type === 'land.camped').length;
  return [
    hours >= 0 ? `Out ${hours} hour${hours === 1 ? '' : 's'}` : '',
    nights ? `${nights} night${nights > 1 ? 's' : ''} camped` : '',
  ]
    .filter(Boolean)
    .join(', ');
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
  const state = out ? 'out' : end?.type === 'land.lost' ? 'not home' : 'home';
  return {
    title: `${nameOf(w, trip.who)}, ${forWords(trip.good)} · ${state}`,
    sub: [spentOf(w, trip, lines, start), out ? '' : outcomeOf(trip, end)]
      .filter(Boolean)
      .join(' · '),
    lines: lines.map((e) => {
      const at = atOf(w, e, trip);
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
