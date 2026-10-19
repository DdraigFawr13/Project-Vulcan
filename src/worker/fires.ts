// Fires and work in progress as the page shows them (P3.6): the hearth's art by state, the lit
// fires for the map's firelight, a hearth's tile rows, a room's warmth in words, the "doing now"
// of tending and hearth-making, and the progress of what is being built. Every value is the
// engine's answer put into words; nothing here decides a rule (GAME-02). Pure reads of the world.
import { content } from '../content/index.ts';
import {
  feltAt,
  fireOf,
  furnitureKind,
  furnitureOf,
  placeOf,
  plansOf,
  recordOf,
  roomAt,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView, LedgerLine } from './protocol.ts';
import type { PieceView } from './protocol-build.ts';

const fuels = content.work.fire.fuels;
const itemName = (id: string): string => content.items.find((i) => i.id === id)?.name ?? id;
const isHearth = (piece: EntityRow): boolean => piece['kind'] === 'hearth';

/** The art a hearth shows by its fire: the cold ring, lit flames or banked embers. */
export function hearthArt(world: WorldState, piece: EntityRow, art: string): string {
  if (!isHearth(piece) || piece['state'] !== 'built') return art;
  const fire = fireOf(world, piece.id);
  return fire?.['lit'] ? `${art}.${fire['banked'] ? 'banked' : 'lit'}` : art;
}

/** Whole minutes in words: "2 h 10 min", "45 min". */
export function minutesWords(minutes: number): string {
  const [h, m] = [Math.floor(minutes / 60), minutes % 60];
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** The lit fires for the map's firelight: where, and how far the glow reaches in tiles (a
 * room's farthest tile from the fire, else the open radius, plus one for the fade). */
export function fireGoods(world: WorldState): GoodsView['fires'] {
  const width = world.map.width;
  return (world.entities['fire'] ?? [])
    .filter((f) => f['lit'])
    .map((f) => {
      const piece = furnitureOf(world).find((p) => p.id === f['piece'])!;
      const [x, y] = [piece['x'] as number, piece['y'] as number];
      const room = roomAt(world, content, x, y);
      const radius = room
        ? room.tiles.reduce(
            (far, i) =>
              Math.max(far, Math.abs((i % width) - x), Math.abs(Math.floor(i / width) - y)),
            0,
          )
        : content.work.fire.radius;
      return { x, y, z: 0, radius: radius + 1, banked: !!f['banked'] };
    });
}

/** The line a fire's last change is labelled with. */
const LABELS: Record<string, string> = {
  'fire.built': 'Built',
  'fire.lit': 'Lit',
  'fire.banked': 'Banked',
  'fire.unbanked': 'Burning up',
  'fire.out': 'Out',
  'work.tookUpTending': 'Tended',
};

/** A built hearth's rows for its tile: lit, banked or out, its fuel, and the last line. */
export function fireView(
  world: WorldState,
  piece: EntityRow,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): NonNullable<PieceView['fire']> | undefined {
  const fire = isHearth(piece) ? fireOf(world, piece.id) : undefined;
  if (!fire) return undefined;
  const here = placeOf(world, content, piece);
  const fuel = fuels.find((f) => f.id === fire['kind']);
  const left = fire['fuel'] as number;
  const banked = !!fire['banked'];
  const last = recordOf(world, fire['line'] as number);
  const name = itemName(fuel?.item ?? fuels[0]!.item);
  const lasts =
    fuel && banked ? ` (banked, it lasts ${minutesWords(left * fuel.banked.rate)})` : '';
  return {
    where: here.where,
    state: !fire['lit'] ? 'out' : banked ? 'banked, burning low until dawn' : 'lit',
    fuel: left ? `${name}, ${minutesWords(left)} left${lasts}` : `no ${name} in it`,
    reach: here.indoors
      ? `the ${here.room}`
      : `the ground within ${content.work.fire.radius} tiles`,
    ...(last && { last: lineOf(last), lastLabel: LABELS[last.type] ?? 'Last' }),
  };
}

/** The room warmth row for tile (x, y): a word and degrees (the weather and the fires, as the
 * people feel it), and whether the room has a hearth and how it burns. */
export function roomWarmth(world: WorldState, x: number, y: number): string {
  const room = roomAt(world, content, x, y);
  const degrees = feltAt(world, content, y * world.map.width + x);
  const def = content.life.needs.find((n) => n.id === 'warmth');
  const word = degrees >= content.life.warmth.comfort ? def?.okWord : def?.lowWord;
  const inside = new Set(room?.tiles);
  const hearth = furnitureOf(world).find(
    (f) =>
      isHearth(f) &&
      f['state'] === 'built' &&
      inside.has((f['y'] as number) * world.map.width + (f['x'] as number)),
  );
  const fire = hearth && fireOf(world, hearth.id);
  const about = !fire
    ? 'no hearth'
    : !fire['lit']
      ? 'hearth out'
      : fire['banked']
        ? 'hearth banked'
        : 'hearth lit';
  return `${word ?? ''}, ${String(degrees).replace('-', '−')} °C · ${about}`;
}

/** A tender's "doing now" key and the words to fill it (content `work.doing`): splitting logs,
 * or tending a fire for the reason on the line that took the work up. */
export function tendDoing(
  world: WorldState,
  p: EntityRow,
): { key: string; vars: Record<string, string> } {
  if ((p['plan'] as number) < 0) return { key: 'split', vars: {} };
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  const took = recordOf(world, p['took'] as number);
  const why = took && 'data' in took ? took.data['why'] : undefined;
  const where = piece ? placeOf(world, content, piece).where : '';
  return typeof why === 'string'
    ? { key: 'tend', vars: { why, where } }
    : { key: 'tendBare', vars: { where } };
}

/** The words for a builder making a hearth: "hearth" in a room, else "campfire". */
export function hearthDoing(world: WorldState, p: EntityRow): Record<string, string> {
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  if (!piece) return { kind: 'hearth', where: '' };
  const here = placeOf(world, content, piece);
  return { kind: here.indoors ? 'hearth' : 'campfire', where: here.where };
}

/** The piece or part is being worked by this person's job. */
const WORKING: Record<string, string[]> = { plan: ['build'], furniture: ['carpentry', 'hearth'] };

// The minutes a plan or piece started with, remembered while it is being worked: the engine counts
// the minutes left (`work`) down from a total it does not keep, so the page keeps the largest it
// has seen. Per world, and never saved: a loaded save starts each bar from what is left.
const totals = new WeakMap<WorldState, Map<string, number>>();

/** The bar over each plan, part or piece someone is working on right now: minutes done and the
 * total, the page draws the fill between snapshots. Hidden while nobody works it or once done. */
export function workBars(world: WorldState): GoodsView['work'] {
  const seen = totals.get(world) ?? new Map<string, number>();
  totals.set(world, seen);
  const people = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
  const bars: GoodsView['work'] = [];
  const live = new Set<string>();
  const rows: [string, EntityRow[]][] = [
    ['plan', plansOf(world).filter((r) => r['state'] !== 'built')],
    ['furniture', furnitureOf(world).filter((r) => r['state'] !== 'built')],
  ];
  for (const [table, list] of rows)
    for (const r of list) {
      const left = r['work'] as number;
      if (!(left >= 0)) continue;
      const key = `${table}:${r.id}:${r['state'] as string}`;
      live.add(key);
      // The minute just worked took one off the start, so the total is at least one more than left.
      const total = Math.max(seen.get(key) ?? 0, left + 1);
      seen.set(key, total);
      // On it now: someone who has stepped away to warm up still holds the job, but is not at it.
      const worked = people.some(
        (p) =>
          p['doing'] === 'work' &&
          WORKING[table]!.includes(p['job'] as string) &&
          p['plan'] === r.id,
      );
      if (worked)
        bars.push({
          x: r['x'] as number,
          y: r['y'] as number,
          z: (r['z'] as number | undefined) ?? 0,
          done: total - left,
          total,
        });
    }
  for (const key of seen.keys()) if (!live.has(key)) seen.delete(key);
  return bars;
}

/** The kind a piece's fire is named after on its tile page: "hearth" in a room, else "campfire". */
export const hearthName = (world: WorldState, piece: EntityRow): string =>
  placeOf(world, content, piece).indoors ? furnitureKind(content, piece).name : 'campfire';
