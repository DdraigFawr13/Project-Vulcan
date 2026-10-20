// Death and burial as the page shows them (P5.6, P5.8): the graves and burial ground on the map,
// a grave's and a burial-ground tile's page, the Build sheet's burial row, a sickroom's beds and
// who lies where. Every value is the engine's answer put into words (GAME-02); nothing here
// chooses a tile or a person (V-041). Pure reads of the world, like mine.ts.
import { content } from '../content/index.ts';
import {
  bodiesOf,
  burialGround,
  clockAt,
  dirFrom,
  freePlots,
  gravesOf,
  greenOf,
  houseAt,
  openWounds,
  piecesOf,
  rectOf,
  recordOf,
  woundName,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine, TileView } from './protocol.ts';
import type { GoodsView } from './protocol-goods.ts';
import type { BurialRow, PlaceView } from './protocol-build.ts';
import type { WalkerView } from './protocol-people.ts';

export const word = (key: string): string => content.health.words[key] ?? key;
const fill = (text: string, vars: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const people = (world: WorldState): EntityRow[] => world.entities['person'] ?? [];
const personOf = (world: WorldState, id: unknown): EntityRow | undefined =>
  people(world).find((p) => p.id === id);

/** The graves and the burial ground's rectangle, for the map. */
export function burialGoods(world: WorldState): Pick<GoodsView, 'graves' | 'burial'> {
  const ground = burialGround(world);
  return {
    graves: gravesOf(world).map((g) => ({
      x: g['x'] as number,
      y: g['y'] as number,
      z: 0,
      dug: g['state'] === 'dug',
      marker: g['marker'] === 1,
    })),
    burial: ground ? [rectOf(ground)] : [],
  };
}

/** Who lies down, who is dead and who is buried, for the map: each snapshot's walkers get these. */
export function withLying(world: WorldState, walkers: WalkerView[]): WalkerView[] {
  const bodies = new Map(bodiesOf(world).map((b) => [b['person'], b]));
  const status = new Map(people(world).map((p) => [p.id, p['status']]));
  return walkers.map((w) => {
    const body = bodies.get(w.id);
    const s = status.get(w.id);
    const lying = s === 'buried' ? 'buried' : s === 'dead' ? 'dead' : body?.['down'] ? 'down' : '';
    if (!lying) return w;
    return { ...w, lying, ...(body?.['carrier'] ? { carried: true as const } : {}) };
  });
}

/** The Build sheet's burial row: shown once the colony has laid a ground out. */
export function burialRow(world: WorldState): BurialRow | undefined {
  const b = burialGround(world);
  if (!b) return undefined;
  const graves = gravesOf(world).length;
  return {
    id: b.id,
    dir: dirFrom(greenOf(world), rectOf(b)),
    w: b['w'] as number,
    h: b['h'] as number,
    why: word('groundWhy'),
    back: !b['sent'] && !graves,
    sent: !!b['sent'],
    graves,
  };
}

/** "Human, 34. Came with the band from Dalig." for the dead, at their death. */
function aboutOf(p: EntityRow, died: number): string {
  const year = clockAt(died, content.calendar).year;
  const race = content.races.find((r) => r.id === p['race'])?.name ?? String(p['race']);
  const home = p['home'] ? ` Came with the band from ${p['home'] as string}.` : '';
  return `${race}, ${year - (p['born'] as number)}.${home}`;
}

/** The grave or burial ground on surface tile (x, y), for its page. */
export function tilePlace(
  world: WorldState,
  x: number,
  y: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): Pick<TileView, 'place'> {
  const ground = burialGround(world);
  const grave = gravesOf(world).find((g) => g['x'] === x && g['y'] === y);
  const sited = ground && recordOf(world, ground['line'] as number);
  const inside =
    ground &&
    x >= (ground['x'] as number) &&
    y >= (ground['y'] as number) &&
    x < (ground['x'] as number) + (ground['w'] as number) &&
    y < (ground['y'] as number) + (ground['h'] as number);
  if (!grave && !inside) return {};
  const lines: { label: string; line: LedgerLine }[] = [];
  const add = (label: string, id: unknown): void => {
    const e = recordOf(world, id as number);
    if (e) lines.push({ label, line: lineOf(e) });
  };
  if (!grave) {
    const total = (ground!['w'] as number) * (ground!['h'] as number);
    if (sited) lines.push({ label: 'Sited · ', line: lineOf(sited) });
    return {
      place: {
        name: word('groundTitle'),
        sub: word('groundSub'),
        rows: [
          ['sited', word('groundWhy')],
          ['plots', fill(word('plotsFree'), { free: freePlots(world).length, total })],
        ],
        lines,
      },
    };
  }
  const dead = personOf(world, grave['person']);
  const body = bodiesOf(world).find((b) => b['person'] === grave['person']);
  const filled = grave['state'] === 'filled';
  const place: PlaceView = {
    name: word('graveTitle'),
    sub: word('graveSub'),
    rows: [],
    lines,
  };
  if (dead) {
    place.who = `${dead['name'] as string}${dead['home'] ? ` of ${dead['home'] as string}` : ''}`;
    const diedLine = recordOf(world, body?.['died'] as number);
    const since = filled ? recordOf(world, grave['buried'] as number) : undefined;
    const date = since && lineOf(since).clock;
    place.about = filled
      ? `${aboutOf(dead, diedLine?.tick ?? 0)}${date ? ` Lies here since ${date.day} ${date.monthName}, year ${date.year}.` : ''}`
      : fill(word('dugFor'), { name: dead['name'] as string });
    const by = personOf(world, grave['by']);
    if (by) place.rows.push(['buried by', fill(word('buriedBy'), { by: by['name'] as string })]);
    place.rows.push(['marker', grave['marker'] ? word('markerYes') : word('markerNo')]);
    const mourners =
      since && isEvent(since)
        ? since.actors
            .filter((id) => id !== dead.id)
            .map((id) => personOf(world, id)?.['name'] as string)
            .filter(Boolean)
        : [];
    if (mourners.length) place.rows.push(['mourners', mourners.join(', ')]);
  }
  add('Died · ', body?.['died']);
  if (filled) add('Buried · ', grave['buried']);
  add('Burial · ', grave['line']);
  if (ground) add('Burial ground · ', ground['line']);
  return { place };
}

/** The sickroom's bed row: "2: Hrakmar (broken leg), free", or "none yet" before a bed is made. */
export function sickBeds(world: WorldState, house: EntityRow): string {
  const beds = piecesOf(world, 'bed').filter((b) => {
    const h = houseAt(world, b['x'] as number, b['y'] as number);
    return h?.id === house.id;
  });
  if (!beds.length) return 'none yet';
  const bodies = bodiesOf(world);
  const who = beds.map((b) => {
    const body = bodies.find((q) => q['bed'] === b.id);
    const p = body && personOf(world, body['person']);
    if (!p || p['status'] !== 'alive') return word('sickFree');
    const wound = openWounds(world, p.id).sort(
      (a, c) =>
        content.health.severities.findIndex((s) => s.id === c['severity']) -
          content.health.severities.findIndex((s) => s.id === a['severity']) || a.id - c.id,
    )[0];
    return wound ? `${p['name'] as string} (${woundName(content, wound)})` : (p['name'] as string);
  });
  return `${beds.length}: ${who.join(', ')}`;
}

/** A whole line, not a stub left by a sealed day. */
const isEvent = (e: SimEvent | Stub): e is SimEvent => 'actors' in e;
