// The known map's views (6W Slice 6, V-213): which surface chunks to resend as known land grows,
// the flags on found places, and a found place's rows on its tile page. Pure reads of the world.
import { content } from '../content/index.ts';
import {
  cap,
  CHUNK,
  chunksAcross,
  clockAt,
  compass,
  entityOf,
  greenOf,
  itemName,
  placeKind,
  recordOf,
  type Find,
  type MapState,
  type Place,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { FindMark, FindView } from './protocol-land.ts';
import type { LedgerLine } from './protocol.ts';

/** Known land is not a tile change, so it raises no chunk version: the worker counts each surface
 * chunk's known tiles once a tick and resends a chunk whose count grew. */
export function knownFeed() {
  let counts: number[] = [];
  let tick = -1;
  return {
    reset(): void {
      counts = [];
      tick = -1;
    },
    /** Surface chunks whose known land changed since the last tick looked at. */
    grown(map: MapState, now: number): Set<number> {
      const grown = new Set<number>();
      if (now === tick) return grown;
      tick = now;
      const across = chunksAcross(map);
      const next = new Array<number>(counts.length || across * Math.ceil(map.height / CHUNK)).fill(
        0,
      );
      for (let i = 0; i < map.known.length; i += 1)
        if (map.known[i] === 1) {
          const x = i % map.width;
          const y = (i - x) / map.width;
          next[Math.floor(y / CHUNK) * across + Math.floor(x / CHUNK)]! += 1;
        }
      next.forEach((n, c) => n !== (counts[c] ?? 0) && grown.add(c));
      counts = next;
      return grown;
    },
  };
}

/** A scout's news that counted as a find (V-205): at least `least` sources round its place. */
const isFind = (f: Find): boolean => f.count >= content.terrain.generator.known.least;

/** A place laid at worldgen that someone has found (V-206): its line is set then. */
const isFound = (p: Place): boolean => p.line > 0;

/** The flags: each scout's find, then each found place, on known land, one to a tile. */
export function findMarks(w: WorldState): FindMark[] {
  const { map } = w;
  const seen = new Set<number>();
  const marks: FindMark[] = [];
  for (const { x, y } of [...map.finds.filter(isFind), ...map.places.filter(isFound)]) {
    const i = y * map.width + x;
    if (map.known[i] !== 1 || seen.has(i)) continue;
    seen.add(i);
    marks.push({ x, y });
  }
  return marks;
}

/** The flags as a feed: each snapshot gets them only when they changed. */
export function findFeed() {
  let sent = '';
  return {
    reset: (): void => void (sent = ''),
    next(w: WorldState): FindMark[] | undefined {
      const marks = findMarks(w);
      const key = JSON.stringify(marks);
      if (key === sent) return undefined;
      sent = key;
      return marks;
    },
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "07:00, Day 24 of Deepwinter, year 3". */
export function whenWords(tick: number): string {
  const c = clockAt(tick, content.calendar);
  const month = content.calendar.monthNames[c.month];
  return `${pad(c.hour)}:${pad(c.minute)}, Day ${c.day} of ${month}, year ${c.year}`;
}

/** What a good is called on the Stock sheet ("wood" for logs). */
export const goodName = (good: string): string =>
  content.work.stock.find((s) => s.good === good)?.name ?? good;

type LineOf = (e: SimEvent | Stub) => LedgerLine;

/** "56 tiles south-west of home". */
function fromHome(w: WorldState, x: number, y: number): string {
  const g = greenOf(w);
  return `${Math.max(Math.abs(x - g.x), Math.abs(y - g.y))} tiles ${compass(x - g.x, y - g.y)} of home`;
}

const personName = (w: WorldState, id: number): string | undefined =>
  entityOf(w, 'person', id)?.['name'] as string | undefined;

/** The page of the find flagged on (x, y), if one is: what, who, when, how it is worked. A
 * scout's find comes first; else a found place. */
export function tileFind(w: WorldState, x: number, y: number, lineOf: LineOf): { find?: FindView } {
  if (w.map.known[y * w.map.width + x] !== 1) return {};
  const f = [...w.map.finds].reverse().find((t) => t.x === x && t.y === y && isFind(t));
  const def = f && content.work.scout.goods.find((g) => g.good === f.good);
  if (!f || !def) return placePage(w, x, y, lineOf);
  const who = personName(w, f.who);
  const left = sourcesLeft(w.map, x, y, def.kinds);
  const r = content.terrain.generator.known.place;
  const line = recordOf(w, f.line);
  return {
    find: {
      title: cap(def.find),
      rows: [
        ['find', `${def.find}, about ${f.count} ${def.unit}, ${fromHome(w, x, y)}`],
        ['found by', `${who ?? 'a scout'}, scouting for ${goodName(f.good)}`],
        ['when', whenWords(f.tick)],
        [
          'worked',
          `as if in reach, ${r} tiles round it; ${left ? `${left} ${def.unit} left` : 'none left'}`,
        ],
      ],
      ...(line && { line: lineOf(line) }),
    },
  };
}

/** A found place's page: what and where, who found it and when, and what it is for (its kind's
 * `then` words: under "worked" for a kind with a `use`, else under "seen"). */
function placePage(w: WorldState, x: number, y: number, lineOf: LineOf): { find?: FindView } {
  const p = w.map.places.find((t) => t.x === x && t.y === y && isFound(t));
  const kind = p && placeKind(content, p.kind);
  if (!p || !kind) return {};
  const line = recordOf(w, p.line);
  // A seam names its ore and colour (V-215): "a green seam of copper".
  const vein = p.what ? content.features.find((f) => f.id === p.what) : undefined;
  const name = vein?.vein?.seam
    ? `a ${vein.vein.seam} seam of ${itemName(content, vein.yields).replace(/ ore$/, '')}`
    : kind.name;
  return {
    find: {
      title: cap(name),
      rows: [
        ['find', `${name}, ${fromHome(w, x, y)}`],
        ['found by', personName(w, p.by) ?? 'someone of the colony'],
        ['when', whenWords(p.tick)],
        [kind.use ? 'worked' : 'seen', kind.then],
      ],
      ...(line && { line: lineOf(line) }),
    },
  };
}

/** The need's sources still standing on known land within `place` of (x, y). */
function sourcesLeft(map: MapState, x: number, y: number, kinds: readonly string[]): number {
  const r = content.terrain.generator.known.place;
  let n = 0;
  for (let yy = Math.max(0, y - r); yy <= Math.min(map.height - 1, y + r); yy += 1)
    for (let xx = Math.max(0, x - r); xx <= Math.min(map.width - 1, x + r); xx += 1) {
      const i = yy * map.width + xx;
      const f = map.features[i]!;
      if (f && map.known[i] === 1 && kinds.includes(content.features[f - 1]!.kind)) n += 1;
    }
  return n;
}
